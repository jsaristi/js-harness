#!/usr/bin/env node
// The one gate a pre-commit hook and CI both run. Zero deps, plain Node.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn as spawnChild, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { estimateTokens, measurePayload } from './lib/payload.mjs';
import { fixedLoadRow } from './lib/fixed-load.mjs';
import { discoverContracts, validateEntries } from './contract.mjs';
import { checkFailures } from './failures.mjs';
import { checkSpec } from './lib/spec.mjs';
import { readProjectRules } from './lib/project-rules-read.mjs';
import { PROJECT_RULES_PATH } from './lib/project-rules.mjs';
import { readRules, ruleValue } from './lib/rules.mjs';
import { RULES } from './lib/rules-data.mjs';
import { rulesOfText } from './lib/rules-change-run.mjs';
import { inForceLines, isTextInForce, scanLines } from './lib/rules-scan.mjs';
import { numstatFiles, reviewParts } from './lib/codex-review-parts.mjs';
import { MAX_PARTS_WITHOUT_FLAG, partsBound } from './lib/codex-review-plan.mjs';
import { defaultBranch, gitOut, MARKS_UNREAD, mergeStart, NOT_A_REVIEW, notReviews, rangeDiff, rangeStart, reviewCoverage, reviewStart } from './lib/codex-review-coverage.mjs';
import { mergeTurn, turnsCheaper } from './lib/codex-review-turns.mjs';
import { codexReviewsPath } from './lib/codex-reviews.mjs';
import { isValidCodexReview, readCodexReviews } from './lib/codex-reviews.mjs';
import { readCodexReviewRuns } from './lib/codex-review-runs.mjs';
import { classifyRecheck, priorLine, recheckState, runAnswerFindings } from './lib/codex-review-recheck.mjs';
import { leftOutOf, reviewScope } from './lib/codex-review-scope.mjs';
import { killSurvivors, killTree } from './lib/process-tree.mjs';
import { GATE_WAIT_MS, readGateWaiters, takeGateLock } from './lib/gate-lock.mjs';
import { GateFirstError, cancelTicket, claimTicket, issueTicket, logTicket, ofTree, readTickets } from './lib/gate-first.mjs';
import { loadDetail, loadLines, loadSwitchedOff, readLoad } from './lib/machine-load.mjs';
import { watchBusiest } from './lib/machine-busiest.mjs';
import { gateLogSwitchedOff, gateRecord, provenBy, readGateLog } from './lib/gate-log.mjs';
import { treeKey } from './lib/gate-tree.mjs';
import { addedLines, checkedOff, checkedTasks, resolveCitations, resolveTicks, taskText } from './lib/citations.mjs';
import { flakyTestsOf, selectTests, testFilesOf } from './lib/select-tests.mjs';
import { checkLedger, failedTestFiles, judgeRerun, ledgerEntries, localDay } from './lib/flaky.mjs';
import { TRACE_PRELOAD, readTraces, stateOf, traceEnv, traceEnvOf } from './lib/trace-reads.mjs';
import { RUNNER_ENV, TIMED_OUT_MARK, innerSeconds, leftPaths, mirrorName, readGateWsl, runnerScript, syncedMs, toWslPath, word as bashWord, wslCommand, wslNodeVersion } from './lib/gate-wsl.mjs';
import { commitTree, functionsOf, gitIn, harnessOfCommit, harnessOfTree, workingTree } from './lib/project-functions.mjs';
import { clonePending } from './lib/project.mjs';
import { readProjectRules as readRulesData } from './lib/codex-review-allowance.mjs';
import { ruleHere, ruleOf } from './lib/rules.mjs';
import { compareLaunches, subagentRowLines } from './lib/subagent-check.mjs';
import { dayOf, launchesOf } from './lib/subagent-count.mjs';
import { readRecords, recordFolders } from './subagents.mjs';
import { CI_WORKFLOW, ciGateWanted, runCiGate } from './lib/ci-gate.mjs';

export { estimateTokens };

// The budget AGENTS.md is held to: the declared rule `agents-budget` (bin/lib/rules-data.mjs).
export const TOKEN_BUDGET = ruleValue('agents-budget', 'estimated tokens');

/** PASS/FAIL row for AGENTS.md's token budget, rooted at `cwd`. */
export function checkBudget(cwd) {
  const agentsPath = path.join(cwd, 'AGENTS.md');
  if (!fs.existsSync(agentsPath)) {
    return { name: 'budget', pass: false, detail: 'AGENTS.md not found' };
  }
  const text = fs.readFileSync(agentsPath, 'utf8');
  const tokens = estimateTokens(text);
  const pass = tokens <= TOKEN_BUDGET;
  const detail = `${tokens} estimated tokens (budget ${TOKEN_BUDGET})`;
  return { name: 'budget', pass, detail };
}

/** The `contracts` row: every contract under `odd/tasks/` must pass `js-harness contract check`.
 * Static only: it never runs a done-when command, which may be `npm run check` itself. */
export function checkContracts(cwd) {
  const name = 'contracts';
  const results = validateEntries(discoverContracts(cwd));
  if (results.length === 0) return { name, pass: true, detail: 'no contracts under odd/tasks' };
  const plural = (n) => `${n} contract${n === 1 ? '' : 's'}`;
  const failed = results.filter((result) => !result.ok);
  if (failed.length === 0) {
    return { name, pass: true, detail: `${plural(results.length)} checked`, lines: results.map((result) => result.label) };
  }
  const lines = failed.flatMap(({ label, errors }) => [label, ...errors.map((reason) => `  ${reason}`)]);
  return { name, pass: false, detail: `${failed.length} of ${plural(results.length)} fail`, lines };
}

/** Shortens `filePath` to start with `~` when it lies under `home`, so rows stay readable. */
function tildePath(filePath, home) {
  if (!filePath) return 'built-in or plugin';
  const relative = path.relative(home, filePath);
  return relative.startsWith('..') || path.isAbsolute(relative) ? filePath : path.join('~', relative);
}

/** One INFO row per host with every file that loads on each turn and the hooks whose stdout
 * reaches the model. Informational: the budget row alone decides pass or fail. */
export function checkPayload(cwd, home) {
  return measurePayload({ home, cwd }).hosts.map((host) => {
    const sources = host.sources.map((s) => {
      const tokens = s.tokens === null ? 'not found' : String(s.tokens);
      return `${s.name.padEnd(18)} ${tokens.padStart(9)}  ${tildePath(s.path, home)}`;
    });
    // A plugin's hook names the plugin it comes from; a settings hook keeps its row as it was.
    const hooks = host.hooks.map((h) => `hook ${h.event.padEnd(16)} ${h.plugin ? `${h.plugin}: ` : ''}${h.command}`);
    const detail = `${host.total} estimated tokens per turn from files (tools and hook output not counted)`;
    return { name: `payload ${host.host}`, pass: true, info: true, detail, lines: [...sources, ...hooks] };
  });
}

// A sensor that never exits (a watch-mode script, a linter waiting on stdin) would hold the pre-commit
// gate forever, so the wait is bounded twice. A sensor that hangs writes nothing, so it is stopped once it
// has been silent for `sensor-silence`; a slow suite keeps writing and finishes, where a bound on length
// refused the whole suite on Windows (first-version L18, L28). The ceiling, `sensor-timeout`, stays for a
// sensor that hangs while it writes. Both are declared rules (bin/lib/rules-data.mjs).
export const SENSOR_TIMEOUT_MS = ruleValue('sensor-timeout', 'minutes') * 60 * 1000;
export const SENSOR_SILENCE_MS = ruleValue('sensor-silence', 'minutes') * 60 * 1000;
const TREE_TIMEOUT_MS = 20_000; // one listing of the working tree's untracked paths (`untrackedPaths`)

// The variables that bind a git command to one repository, as `git rev-parse --local-env-vars` lists
// them. Git exports some to a hook: from a linked worktree, `GIT_DIR` and an absolute `GIT_INDEX_FILE`.
const GIT_LOCAL_ENV = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX',
  'GIT_SHALLOW_FILE',
  'GIT_COMMON_DIR',
];

// Those of them that say which repository a git command acts on and which index it reads. A pre-commit
// hook is always given `GIT_INDEX_FILE`, and in a linked worktree `GIT_DIR`; see `stagedDocuments`.
const GIT_BINDING_ENV = ['GIT_DIR', 'GIT_INDEX_FILE', 'GIT_WORK_TREE'];

// What `.githooks/pre-merge-commit` exports to say that the commit is a merge's: git runs that hook before it
// writes MERGE_HEAD (`checkCommitSize`). It is this gate's word alone, and no sensor inherits it (`checkSensor`).
const MERGE_HOOK_ENV = 'JS_HARNESS_HOOK';

const NPM_PLACEHOLDER_TEST ='echo "Error: no test specified" && exit 1';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isCommand = (value) => typeof value === 'string' && value.trim() !== '';

/** Reads and parses `<cwd>/<file>`: `{ value }`, `{ error }` naming the file when it is not JSON, or
 * `null` when it does not exist. */
function readJson(cwd, file) {
  const filePath = path.join(cwd, file);
  if (!fs.existsSync(filePath)) return null;
  try {
    return { value: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch (err) {
    return { error: `${file} is not valid JSON: ${err.message}` };
  }
}

/** `harness.json` of `cwd` as `{ declared }`, the object it holds, or `undefined` where there is no such
 * file; `{ error }` when it is not JSON or holds no object. */
function readHarness(cwd) {
  const harness = readJson(cwd, 'harness.json');
  if (harness?.error) return { error: harness.error };
  if (harness && !isObject(harness.value)) return { error: 'harness.json must be a JSON object' };
  return { declared: harness?.value };
}

/** The project's sensors: named commands that must exit 0. `harness.json` `sensors` wins, which serves
 * any language; else the `test`, `lint` and `typecheck` scripts of `package.json`, run through npm so
 * `node_modules/.bin` is on the path. A file that is unreadable or of the wrong shape is an `error`,
 * never a silent skip: a gate that quietly ran nothing would look green. */
export function discoverSensors(cwd) {
  const none = { sensors: [], source: null };
  const { declared, error } = readHarness(cwd);
  if (error) return { ...none, error };
  if (declared && 'sensors' in declared) {
    // An empty map is a deliberate opt-out: it declares no sensor and does not fall back to package.json.
    const { sensors } = declared;
    if (!isObject(sensors) || !Object.values(sensors).every(isCommand)) {
      return { ...none, error: 'harness.json "sensors" must be an object of names to non-empty command strings' };
    }
    return { sensors: Object.entries(sensors).map(([name, command]) => ({ name, command })), source: 'harness.json' };
  }

  const pkg = readJson(cwd, 'package.json');
  if (pkg?.error) return { ...none, error: pkg.error };
  if (!pkg) return none;
  const scripts = pkg.value?.scripts;
  const scriptOf = (script) => (scripts && typeof scripts === 'object' ? scripts[script] : undefined);
  const sensors = [['tests', 'test'], ['lint', 'lint'], ['typecheck', 'typecheck']]
    // `npm init` writes this exact test script, which only fails; it is no test.
    .filter(([, script]) => isCommand(scriptOf(script)) && !(script === 'test' && scriptOf(script) === NPM_PLACEHOLDER_TEST))
    .map(([name, script]) => ({ name, command: `npm run ${script}` }));
  return { sensors, source: 'package.json' };
}

/** The row of a project's own rules (odd/tasks/project-rules.md, "How it is checked"): it acts only when the project
 * keeps a list, docs/rules.json, and never in the harness's own repository, whose row is `checkListRow` (T16d of
 * odd/tasks/rule-hierarchy.md). The project's row fails on any finding of `js-harness rules check`: a phrase gone from its
 * file, a sensor no longer declared, a rule deleted since HEAD, or a list that cannot be read. A list that cannot be
 * read fails this row only: no other row reads it, so the gate still prints every row before it stops. */
export function checkOwnRules(cwd, { rules = RULES, spawn = spawnSync, env = process.env } = {}) {
  if (fs.existsSync(path.join(cwd, 'bin', 'lib', 'rules-data.mjs'))) return checkListRow(cwd, rules, spawn, STAGED, env);
  const found = discoverSensors(cwd);
  let read;
  try {
    read = readProjectRules(cwd, { sensors: found.error ? null : found.sensors.map((sensor) => sensor.name) });
  } catch (err) {
    return [{ name: 'rules', pass: false, detail: `${PROJECT_RULES_PATH} cannot be read: ${err.message}` }];
  }
  if (!read.present) return [];
  const notes = read.notes.map((note) => `note: ${note}`);
  if (read.findings.length === 0) {
    const n = read.rules.length;
    const detail = `${n} ${n === 1 ? 'rule' : 'rules'} of the project ${n === 1 ? 'holds' : 'hold'} (${PROJECT_RULES_PATH})`;
    return [{ name: 'rules', pass: true, detail, ...(notes.length > 0 && { lines: notes }) }];
  }
  const count = read.findings.length;
  return [{ name: 'rules', pass: false, detail: `${count} ${count === 1 ? 'finding' : 'findings'} in ${PROJECT_RULES_PATH}`, lines: [...read.findings, ...notes] }];
}

/** What a finding of the row `rules` says of its rule's stored `row`. */
function rowState(rule) {
  if (rule.row?.refuses !== undefined) return `which refuses it since ${rule.row.refuses}`;
  if (typeof rule.row?.reports === 'string') return `which reports it again since ${rule.row.since} (${rule.row.reports})`;
  return 'which reports it';
}

/** `text` trimmed, and cut with an ellipsis past 160 characters, so a long one-line text stays one readable line. */
const shortLine = (text) => (text.trim().length > 160 ? `${text.trim().slice(0, 159)}…` : text.trim());

/** The row `rules` of the harness's own repository (odd/tasks/rule-hierarchy.md, "The row `rules` (T16d)"): each
 * line the staged change adds to a text in force, renames detected, that restates the value of a rule in `rules`
 * with patterns. The rule's stored `row` says what its finding is: with none, or `reports`, an INFO line; with
 * `refuses`, a failure, which stops the gate before its sensors. The fences and a feature document's history are
 * read on the staged whole file, since a line alone cannot say whether it is inside one. During a merge a line counts
 * only when it is new against both parents, so a merge is never refused for what a parent brought. `rules` is the
 * list of the package, which in this repository is the checkout itself. No row when no rule carries patterns, the
 * change adds no line to a text in force, or git does not answer. `side` names the two sides of the diff and how a
 * file's text is read: the commit's are `STAGED`, the merge door's are `doorSide` (odd/tasks/rule-hierarchy.md, "The
 * merge door (T16e)"), where a git that does not answer is a failure and the merge of a parent is not filtered. */
function checkListRow(cwd, rules, spawn, side = STAGED, env = process.env) {
  const scanned = rules.filter((rule) => !Object.hasOwn(rule, 'retired') && Array.isArray(rule.patterns));
  if (scanned.length === 0) return [];
  const git = hookGit(cwd, spawn);
  // The sides named a/ and b/ whatever the clone's diff.mnemonicPrefix says, and a path with an accent unquoted.
  const diffOf = (...against) => git?.(['-c', 'core.quotePath=false', 'diff', '-U0', '-M', '--no-relative', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', ...side.revs(...against)]) ?? null;
  const diff = diffOf();
  if (diff === null) return side.strict ? [UNANSWERED] : [];
  if (!diff) return [];
  const key = (one) => `${one.file}\n${one.line}\n${one.text}`;
  let added = addedLines(diff).filter((one) => isTextInForce(one.file));
  if (side.mergeFilter) {
    // git runs pre-merge-commit before it writes MERGE_HEAD, and names there each commit it merges in a variable
    // GITHEAD_<sha> (harness review b1); a merge committed by hand has MERGE_HEAD.
    const theirs = git(['rev-parse', '-q', '--verify', 'MERGE_HEAD']) !== null
      ? ['MERGE_HEAD']
      : Object.keys(env).map((name) => /^GITHEAD_([0-9a-f]{40,64})$/.exec(name)?.[1]).filter(Boolean);
    for (const parent of theirs) {
      const fromTheirs = new Set(addedLines(diffOf(parent) ?? '').map(key));
      added = added.filter((one) => fromTheirs.has(key(one)));
    }
  }
  if (added.length === 0) return [];
  const inForce = new Map();
  const lines = [];
  for (const one of added) {
    if (!inForce.has(one.file)) {
      const text = side.text(git, one.file);
      if (text === null && side.strict) return [UNANSWERED];
      inForce.set(one.file, new Set(inForceLines(one.file, text ?? '').map((line) => line.line)));
    }
    if (inForce.get(one.file).has(one.line)) lines.push({ path: one.file, line: one.line, text: one.text.replace(/\r$/, '') });
  }
  const byId = new Map(scanned.map((rule) => [rule.id, rule]));
  const findings = scanLines(scanned, lines);
  if (findings.length === 0) return [{ name: 'rules', pass: true, info: true, detail: '0 restated values in the lines this change adds to the texts in force' }];
  const refusing = findings.filter((finding) => byId.get(finding.id).row?.refuses !== undefined).length;
  const counted = `${findings.length} restated ${findings.length === 1 ? 'value' : 'values'} in the lines this change adds`;
  const detail = `${counted}, ${refusing === 0 ? 'none' : refusing} of a rule that ${refusing > 1 ? 'refuses them' : 'refuses it'}`;
  const found = findings.map((finding) => `${finding.path}:${finding.line} restates rule "${finding.id}", ${rowState(byId.get(finding.id))}: ${shortLine(finding.text)} (write \`rule:${finding.id}\` instead of the value, or change the rule with \`js-harness rules change ${finding.id}\`)`);
  return [refusing === 0 ? { name: 'rules', pass: true, info: true, detail, lines: found } : { name: 'rules', pass: false, detail, lines: found }];
}

/** The two sides of the commit's row: what it stages (`git diff --cached`), and a file's text as the index holds it. */
const STAGED = {
  strict: false,
  revs: (...against) => ['--cached', ...against],
  text: (git, file) => git(['show', `:${file}`]),
  mergeFilter: true,
};

/** The row `rules` of the merge door, when git does not answer: the door cannot read what the pull request brings. */
const UNANSWERED = { name: 'rules', pass: false, detail: 'git did not answer, so the door cannot read the lines this pull request brings' };
const RULES_DATA_FILE = 'bin/lib/rules-data.mjs';
const DOOR_BRANCH = 'this pull request changes bin/lib/rules-data.mjs and is not from a rule/ branch: a rule changes only by js-harness rules change';

/** The two sides of the merge door's row: the lines `base`..HEAD brings, and a file's text as HEAD holds it. */
const doorSide = (base) => ({
  strict: true,
  revs: () => [base, 'HEAD'],
  text: (git, file) => git(['show', `HEAD:${file}`]),
  mergeFilter: false,
});

/** The two sides of a push's row: the lines `head` brings past `base`, the remote's default branch, and a file's text
 * as `head` holds it. */
const pushSide = (base, head) => ({
  strict: false,
  revs: () => [`${base}...${head}`],
  text: (git, file) => git(['show', `${head}:${file}`]),
  mergeFilter: false,
});

/** The row of a version tag pushed (`ref` is the name the pre-push hook passes, `refs/tags/vX.Y.Z`): the `version` in
 * package.json at the tagged commit must be that tag without its v, or the push is refused. `upgrade` refuses a copy
 * whose manifest says another version (bin/update.mjs). No row for any other ref, a tag such as `vendor-snapshot`
 * included: only a version tag is a release. */
function checkTagRow(cwd, { ref, head = 'HEAD', spawn = spawnSync } = {}) {
  const tagged = /^refs\/tags\/v(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]*)?)$/.exec(ref ?? '');
  if (!tagged) return [];
  const version = tagged[1];
  const tag = `v${version}`;
  const commit = gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${head}^{commit}`]);
  if (!commit) return [{ name: 'tag', pass: false, detail: `tag ${tag} is refused: ${head} does not name a commit` }];
  const short = commit.slice(0, 7);
  let says = null;
  try {
    says = JSON.parse(gitOut(spawn, cwd, ['show', `${commit}:package.json`]) ?? 'null')?.version ?? null;
  } catch {
    says = null; // a package.json that does not parse says no version
  }
  if (says === version) return [{ name: 'tag', pass: true, detail: `tag ${tag} names version ${version}, the version package.json holds at ${short}` }];
  const what = says === null ? 'has no version' : `says version ${says}`;
  return [{ name: 'tag', pass: false, detail: `tag ${tag} is refused: package.json at ${short} ${what}, not ${version} (the tag without its v)` }];
}

/** The row `rules` of `check --push` (odd/tasks/rule-hierarchy.md, "The merge door (T16e)", item 8): the lines `head`
 * brings past the default branch of `remote`, read as the door reads them, said as INFO whatever a rule's row says:
 * the commit refuses, the push reports, the merge refuses. No row when the remote has no default branch to read. */
function checkPushRules(cwd, { rules = RULES, spawn = spawnSync, head = 'HEAD', remote = 'origin' } = {}) {
  const branch = defaultBranch(spawn, cwd, remote);
  if (branch === null) return [];
  // The harness's own list judges the harness's own repository alone, as `checkOwnRules` has it at a commit.
  if (!gitOut(spawn, cwd, ['ls-tree', head, '--', RULES_DATA_FILE])?.trim()) return [];
  return checkListRow(cwd, rules, spawn, pushSide(branch.ref, head))
    .map((row) => (row.pass ? row : { ...row, pass: true, info: true, detail: `${row.detail}; a push reports it, the merge door refuses it` }));
}

/** The list `bin/lib/rules-data.mjs` holds at HEAD, read as text and checked as the list the rules accept: `{ list }`,
 * `list` being `null` when the file is absent, or `{ row }` with the failure of the row `rules` that says why it is
 * not one. */
function candidateList(git) {
  const listed = git(['ls-tree', 'HEAD', '--', RULES_DATA_FILE]);
  if (listed === null) return { row: UNANSWERED };
  if (listed.trim() === '') return { list: null };
  const text = git(['show', `HEAD:${RULES_DATA_FILE}`]);
  if (text === null) return { row: UNANSWERED };
  let list;
  try {
    list = rulesOfText(text);
  } catch (err) {
    return { row: { name: 'rules', pass: false, detail: `${RULES_DATA_FILE} of this pull request does not parse: ${err.message}` } };
  }
  const faults = readRules(list, { declared: list });
  if (faults.length > 0) return { row: { name: 'rules', pass: false, detail: `${RULES_DATA_FILE} of this pull request does not validate`, lines: faults } };
  return { list };
}

/** The rules the door judges by: the running list's, each with the stricter row of its own and the candidate's. A row
 * that refuses wins over one that does not; a rule the candidate does not declare keeps its own row. The patterns are
 * the running list's, so a pull request cannot loosen the judge it is judged by. */
function stricterRules(running, candidate) {
  const refuses = (rule) => rule?.row?.refuses !== undefined;
  return running.map((rule) => {
    const other = candidate.find((item) => item.id === rule.id);
    const row = refuses(rule) ? rule.row : refuses(other) ? other.row : (rule.row ?? other?.row);
    return { ...rule, row };
  });
}

/** `check --door --base <rev> [--branch <name>]` (odd/tasks/rule-hierarchy.md, "The merge door (T16e)"): the rule rows
 * of the lines `base`..HEAD brings, which merge-queue runs in the candidate's worktree after each merge. It runs the
 * running list (`rules`, the patterns of `main`'s copy of this file) and the row `rules` only; the rest of `check` is
 * not run here. With `branch`, a pull request that changes `bin/lib/rules-data.mjs` from a branch not named `rule/` is
 * refused, since a rule changes only by `js-harness rules change`. A rule's row is the stricter of the running list's
 * and the candidate's, and a candidate list that does not parse or validate is refused. A git that does not answer is a
 * failure of the row, since the door then cannot read what the pull request brings. */
export function checkDoor(cwd, { rules = RULES, spawn = spawnSync, base = null, branch = null } = {}) {
  const git = hookGit(cwd, spawn);
  if (git === null) return [UNANSWERED];
  const rows = [];
  if (branch !== null) {
    const changed = git(['-c', 'core.quotePath=false', 'diff', '--name-only', '--no-renames', base, 'HEAD']);
    if (changed === null) return [UNANSWERED];
    if (!branch.startsWith('rule/') && changed.split(/\r?\n/).includes(RULES_DATA_FILE)) rows.push({ name: 'rules', pass: false, detail: DOOR_BRANCH });
  }
  const candidate = candidateList(git);
  if (candidate.row) return [...rows, candidate.row];
  return [...rows, ...checkListRow(cwd, stricterRules(rules, candidate.list ?? []), spawn, doorSide(base))];
}

const DOCUMENTS_SHAPE ='harness.json "documents" must be an array of paths from the top of the repository, with forward slashes and a final "/" for a folder';

/** What keeps `entry` out of the `documents` of harness.json, as the end of a sentence about it, or
 * `null` when it is taken. */
function documentFault(entry) {
  if (typeof entry !== 'string' || entry === '') return 'is not a non-empty string';
  if (entry.includes('\\')) return 'is written with a backslash';
  if (entry.includes('*')) return 'is a pattern, and none is taken';
  if (entry.startsWith('/') || /^[A-Za-z]:/.test(entry)) return 'is an absolute path';
  // One final `/` is the mark of a folder. What is left must be whole segments, so that no entry is
  // the repository itself (`.`, `./`) or leaves it (`..`).
  const segments = entry.replace(/\/$/, '').split('/');
  return segments.some((segment) => ['', '.', '..'].includes(segment)) ? 'has an empty, "." or ".." segment' : null;
}

/** The paths the project declares as documents, for the one rule that reads them: a commit that holds
 * documents alone runs no sensor (`stagedDocuments`). They are `harness.json` `documents`, an array of
 * paths from the top of the repository with forward slashes: an entry that ends in `/` is a folder and
 * covers every path under it, any other is one file by its whole path. No pattern is taken, and no path
 * that could name the repository itself or leave it.
 *
 * Declared, never assumed: a project without the key declares none and runs its sensors at every commit
 * as it always did, since in another project a document is the product. A value of the wrong shape is
 * an `error`, as for the sensors, and never a list quietly read as empty or as everything. */
export function discoverDocuments(cwd) {
  const none = { documents: [], source: null };
  const { declared, error } = readHarness(cwd);
  if (error) return { ...none, error };
  if (!declared || !('documents' in declared)) return none;
  const { documents } = declared;
  if (!Array.isArray(documents)) return { ...none, error: `${DOCUMENTS_SHAPE}; it is not an array` };
  for (const entry of documents) {
    const fault = documentFault(entry);
    // The entry as JSON: what the file holds reaches the report escaped.
    if (fault) return { ...none, error: `${DOCUMENTS_SHAPE}; ${JSON.stringify(entry)} ${fault}` };
  }
  return { documents, source: 'harness.json' };
}

const DOCUMENT_SENSORS_SHAPE = 'harness.json "documentSensors" must be an object of names to non-empty command strings';

/** How long one sensor of documents may run. They run at a commit that waits for no turn at the gate
 * lock, beside whatever gate holds it, so they are checks of seconds; this is the bound that says so. */
export const DOCUMENT_SENSOR_TIMEOUT_MS = 2 * 60 * 1000;

/** The arguments of a `git diff` that lists the paths a change touches, for asking whether they are documents alone
 * (`stagedDocuments`, and merge-queue's land): renames off, so a file moved into the documents or out of them is listed
 * at both its paths; a submodule listed whatever the repository is set to leave out of a diff; names from the top of the
 * repository, each ended by a NUL. */
export const DOCUMENT_DIFF = ['--name-only', '--no-renames', '--no-relative', '--ignore-submodules=none', '-z'];

/** Whether `paths` are some, and every one of them is in `documents` (`discoverDocuments`): an entry that ends in "/"
 * holds every path below it, any other is one path. */
export function allDocuments(paths, documents) {
  return paths.length > 0 && paths.every((file) => documents.some((entry) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry)));
}

/** The sensors of a commit that holds documents alone: `harness.json` `documentSensors`, named commands
 * of the shape of `sensors`. Such a commit runs none of the project's sensors (`stagedDocuments`), and
 * yet a document may be what a check reads: a rule kept in one, a text a test holds to a figure. These
 * are the checks that still run there, and nowhere else: a commit that holds anything that is no
 * document runs `sensors`, which are expected to cover the documents as well.
 *
 * `documents` are the ones the project declares (`discoverDocuments`). Declared without them these could
 * never run, which is an `error` and not a key quietly ignored; so is a value of the wrong shape. A
 * project without the key, or with an empty map, declares none: its commits of documents run nothing,
 * as before. */
export function discoverDocumentSensors(cwd, documents) {
  const none = { sensors: [] };
  const { declared, error } = readHarness(cwd);
  if (error) return { ...none, error };
  if (!declared || !('documentSensors' in declared)) return none;
  const { documentSensors } = declared;
  if (!isObject(documentSensors) || !Object.values(documentSensors).every(isCommand)) return { ...none, error: DOCUMENT_SENSORS_SHAPE };
  const sensors = Object.entries(documentSensors).map(([name, command]) => ({ name, command }));
  if (sensors.length > 0 && documents.length === 0) {
    return { ...none, error: 'harness.json declares "documentSensors" and no "documents", so no commit would ever run them' };
  }
  return { sensors };
}

/** Whether `one` and `other` are the same folder, however each is spelled (a link on the way, a short
 * Windows name, another case). `false` when either is not there or cannot be looked at. */
function sameFolder(one, other) {
  try {
    return fs.realpathSync.native(one) === fs.realpathSync.native(other);
  } catch {
    return false;
  }
}

/** The paths of the staged change, which is what the commit a gate guards will hold, when every one of
 * them is among `documents` (`discoverDocuments`). `null` when one is not, when nothing is staged (a
 * check run by hand guards no commit; in a hook, an amend is judged against HEAD^, below), and whenever git
 * does not say: no git, no repository, a command that fails. `null` is "run the sensors", so every doubt
 * ends in a gate that runs what it always ran.
 *
 * What is staged is listed in the environment this process was given. A hook is given `GIT_INDEX_FILE`
 * by `git commit <path>` and `git commit -a`, which commit from an index of their own: that index is the
 * commit, not the one `git add` wrote. (A sensor is given none of those variables: `checkSensor`.)
 *
 * That environment is trusted only as the binding of the repository this gate checks. The variables of
 * a hook bind every git command under it to the hook's repository, wherever it runs: a `check --cwd
 * <another project>` started there would list what the hook's repository has staged and hold it
 * against the other project's documents. So where the environment holds one of `GIT_BINDING_ENV`, git
 * is first asked which repository `cwd` is in with none of the repository variables, and then which one
 * the environment binds it to: `null` unless both answer the same git folder and the index named, if
 * one is, lies in that folder, where git keeps its own (`index`, `index.lock`, `next-index-<pid>.lock`;
 * for a linked worktree, under `worktrees/<name>`, which is its git folder). An environment with none
 * of those variables is asked nothing more.
 *
 * Renames are off, so a file moved into the documents or out of them is listed at both its paths. A
 * submodule is listed whatever the repository is set to leave out of a diff (`diff.ignoreSubmodules`,
 * `ignore` in `.gitmodules`): the commit holds its new commit all the same. The
 * names are ended by a NUL and read as they come, since a path may begin with a space. `documents` are
 * named from the top of the repository, so a gate that checks a folder below it skips nothing; under a
 * binding that is asked without it, since git takes the folder a `GIT_DIR` command runs in for the top.
 * With no commit yet git compares the index with nothing, and lists all that is staged.
 *
 * The answer is `{ paths }`, or `{ paths, side }` for an index that differs from its own branch in more
 * than documents and from `side` in documents alone: the trunk merged into a branch of documents, whose
 * code is then the trunk's, which passed its own gates. That merge held the lock 10 minutes for nothing on
 * 2026-10-14 (odd/tasks/merge-documents-skip.md). `side` is `MERGE_HEAD` where git wrote one (`git
 * commit` after `git merge --no-commit`), and the trunk as origin names it (`origin/HEAD`, else
 * `origin/main`, else `origin/master`): the hook of a merge git commits by itself is run before git
 * writes `MERGE_HEAD`, so there the trunk is the side it can know (seen with git 2.54, 2026-10-14).
 * `spawn` stands in for `spawnSync`. */
function stagedDocuments(cwd, documents, spawn = spawnSync) {
  const git = hookGit(cwd, spawn);
  if (git === null) return null;
  /** The paths the index changes against `against` (its own branch when none). */
  const changed = (...against) => git(['diff', '--cached', ...DOCUMENT_DIFF, ...against])?.split('\0').filter(Boolean) ?? [];
  /** `paths` when there are some and all are documents, else `null`. */
  const documentsOnly = (paths) => (allDocuments(paths, documents) ? paths : null);
  /** Whether `ref` names a commit here. */
  const named = (ref) => Boolean(git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])?.trim());
  const staged = changed();
  // Nothing staged is no commit to guard, and no other side is asked: a check run by hand on a branch of
  // documents still runs its sensors over the code it has not staged (Codex, 2026-10-14). A hook is the one
  // exception, told by `GIT_INDEX_FILE`, which git hands every pre-commit hook and a check by hand is not
  // given: there it is `git commit --amend` (or `--allow-empty`), run while HEAD is still the commit it
  // replaces, so the commit it makes changes against HEAD^ what HEAD did. An amend of the message of a
  // commit of documents ran the whole suite and waited for the lock on 2026-10-15 (JH 17).
  if (staged.length === 0) {
    const hooked = Object.keys(process.env).some((key) => key.toUpperCase() === 'GIT_INDEX_FILE');
    const paths = hooked && named('HEAD^') ? documentsOnly(changed('HEAD^')) : null;
    return paths ? { paths, side: 'HEAD^' } : null;
  }
  const own = documentsOnly(staged);
  if (own) return { paths: own };
  const trunk = ['origin/HEAD', 'origin/main', 'origin/master'].find(named);
  for (const side of [...(named('MERGE_HEAD') ? ['MERGE_HEAD'] : []), ...(trunk ? [trunk] : [])]) {
    const paths = documentsOnly(changed(side));
    if (paths) return { paths, side };
  }
  return null;
}

/** The row `citations` (T3 of odd/tasks/commands-and-doctor.md): the lines the staged change adds to the feature
 * documents (`odd/tasks/`), each code span that cites a `path:line` or a commit resolved against the folder and the
 * repository (`bin/lib/citations.mjs`), with one line for each that does not. It is INFO and stops nothing: documents
 * cite other branches and removed files on purpose, so it becomes a failure only once its false alarms have been
 * none over twenty commits. It also reads each task the change checks off (T6, docs/FAILURES.md,
 * record-states-wrong-fact: tasks were checked off while their files were in no commit), which names a commit HEAD
 * reaches or rides with the work it checks off (`resolveTicks`). No row when no feature document is staged, or git
 * does not answer. */
export function checkCitations(cwd, spawn = spawnSync) {
  const git = hookGit(cwd, spawn);
  const diff = git?.(['diff', '--cached', '-U0', '--no-renames', '--no-relative', '--no-color', '--', 'odd/tasks/']);
  if (!diff) return [];
  // The cited file as this commit will hold it, from the index: the working tree may differ from it.
  // A file that ends in a newline has no line after it.
  const staged = (file) => git(['show', `:${file}`]);
  const lineCount = (file) => staged(file)?.replace(/\r?\n$/, '').split(/\r?\n/).length ?? null;
  const commitExists = (id) => git(['cat-file', '-e', `${id}^{commit}`]) !== null;
  const added = addedLines(diff);
  const { checked, unresolved } = resolveCitations(added, { lineCount, commitExists });
  const counted = `${checked} citation${checked === 1 ? '' : 's'} in the lines this change adds to feature documents`;
  let detail = `${counted}, ${unresolved.length === 0 ? 'all resolved' : `${unresolved.length} of them not resolved`}`;
  const lines = unresolved.map((u) => `${u.file}:${u.line} \`${u.citation}\`: ${u.why}`);
  // A file HEAD does not hold had no task checked off before.
  const ticks = checkedOff(added, (file) => checkedTasks(git(['show', `HEAD:${file}`]) ?? ''));
  if (ticks.length > 0) {
    const head = git(['rev-parse', '-q', '--verify', 'HEAD^{commit}'])?.trim();
    // `merge-base --is-ancestor` answers no with exit 1, an unrelated history included (Codex, 2026-10-17); any
    // other exit, or no git, is no claim. `git` has already answered here, so the repository is the one guarded.
    const reaches = (id) => {
      const full = git(['rev-parse', '-q', '--verify', `${id}^{commit}`])?.trim();
      if (!full || !head) return null;
      try {
        const asked = spawn('git', ['merge-base', '--is-ancestor', full, head], { cwd, encoding: 'utf8' });
        if (!asked || asked.error) return null;
        return asked.status === 0 ? true : asked.status === 1 ? false : null;
      } catch {
        return null;
      }
    };
    const names = git(['diff', '--cached', '--name-only', '-z', '--no-relative']) ?? '';
    const rides = names.split('\0').some((name) => name !== '' && !name.startsWith('odd/tasks/'));
    const text = (file, line) => taskText(staged(file) ?? '', line);
    const off = resolveTicks(ticks, { text, commitExists, reaches, rides });
    detail += `; ${ticks.length} task${ticks.length === 1 ? '' : 's'} checked off, ${off.length === 0 ? 'each in a commit HEAD reaches or in this one' : `${off.length} of them in no commit HEAD reaches`}`;
    lines.push(...off.map((u) => `${u.file}:${u.line} ${u.id}${u.citation === null ? '' : ` \`${u.citation}\``}: ${u.why}`));
  }
  const row = { name: 'citations', pass: true, info: true, detail };
  return [lines.length === 0 ? row : { ...row, lines }];
}

/** The row `commit-size` (docs/FAILURES.md, commit-too-large-to-review): the changed lines of the staged change that
 * a review reads, sized as `js-harness codex-review` sizes a range (documents and marked files left out), against
 * the rule `reviewed-commit-lines`. Over it the row fails, so the commit is split before it is made: a commit the
 * reviewer refused had already cost its gate, and remaking it cost two more. The rule is of this repository only,
 * so it is read where the staged rules file is the harness's list (`ruleHere`). No row where it is not in force,
 * when nothing a review reads is staged, while a merge is being made (its commits were made, and sized, on their
 * own branch), or when git cannot say. A merge git commits by itself runs `pre-merge-commit` before MERGE_HEAD is
 * written, so that hook says it in `MERGE_HOOK_ENV`. */
export function checkCommitSize(cwd, spawn = spawnSync, env = process.env) {
  if (env[MERGE_HOOK_ENV] === 'pre-merge-commit') return [];
  const git = hookGit(cwd, spawn);
  if (!git || git(['rev-parse', '-q', '--verify', 'MERGE_HEAD']) !== null) return [];
  const rule = ruleHere('reviewed-commit-lines', 'changed lines', git(['show', ':bin/lib/rules-data.mjs']) ?? undefined);
  if (!Object.hasOwn(rule, 'value')) return [];
  const most = rule.value;
  const numstat = git(['diff', '--cached', '--numstat', '-z', '--no-renames', '--no-relative']);
  if (!numstat) return [];
  let changed;
  try {
    const files = numstatFiles(numstat);
    // The marks are those of the commit being made, as its review will read them: the tree the index holds, so a
    // staged `.gitattributes` counts (Codex, 2026-10-16). Writing that tree is what the commit itself does.
    const tree = git(['write-tree'])?.trim();
    if (!tree) return [];
    const why = leftOutOf(files.map((file) => file.path), { cwd, source: tree, spawn });
    if (why === null) return [];
    changed = reviewScope(files, why).read.reduce((sum, file) => sum + file.changedLines, 0);
  } catch {
    return [];
  }
  if (changed === 0) return [];
  const said = `the staged change has ${counted(changed, 'changed line')} a review reads`;
  const bound = `the ${counted(most, 'changed line')} of rule reviewed-commit-lines`;
  if (changed <= most) return [{ name: 'commit-size', pass: true, detail: `${said}, within ${bound}` }];
  return [{ name: 'commit-size', pass: false, detail: `${said}, over ${bound}: split it into commits under that, each with its own gate, before the reviewer refuses it` }];
}

/** Git as this gate may ask it about the commit it guards: `(args) => stdout`, `null` for a git that did
 * not answer; or `null` itself when the environment is not to be trusted as the binding of the repository
 * of `cwd`, or `cwd` is not its top (the test `stagedDocuments` tells). The one place that test is made,
 * for every question a gate asks of the index it was handed: what is staged, and which tree it guards
 * (`treeKey`). `spawn` stands in for `spawnSync`. */
function hookGit(cwd, spawn = spawnSync) {
  const git = (args, env) => {
    try {
      const result = spawn('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...(env && { env }) });
      return result && !result.error && result.status === 0 ? result.stdout : null;
    } catch {
      return null; // no git on PATH
    }
  };
  /** The lines of what `git rev-parse <args>` answers, one for each thing asked; none when it fails. */
  const asked = (args, env) => git(['rev-parse', ...args], env)?.split(/\r?\n/) ?? [];
  // On Windows a variable is the same in any case, and this process may hold it in another than git's.
  const bound = Object.keys(process.env).some((key) => GIT_BINDING_ENV.includes(key.toUpperCase()));
  const unbound = bound ? Object.fromEntries(Object.entries(process.env).filter(([key]) => !GIT_LOCAL_ENV.includes(key.toUpperCase()))) : undefined;
  const [prefix, own] = asked(['--show-prefix', ...(bound ? ['--absolute-git-dir'] : [])], unbound);
  if (prefix !== '') return null;
  if (bound) {
    const [inherited] = asked(['--absolute-git-dir']);
    if (!sameFolder(own, inherited)) return null;
    // A path that is not whole is one from the folder git runs in, which is `cwd`, the top.
    const index = process.env.GIT_INDEX_FILE;
    if (index !== undefined && !sameFolder(path.dirname(path.resolve(cwd, index)), own)) return null;
  }
  return (args) => git(args);
}

const SAME_TREE_SHAPE = 'harness.json "sameTree" must be "skip", the one value it takes';

/** Whether the project declares that a tree a gate already passed is not run again: `harness.json`
 * `"sameTree": "skip"`, as `{ skip }`. Declared, never assumed: the key of a tree holds no file git
 * ignores, so in a project whose sensors read one (its `node_modules`) the same key can stand for two
 * answers, and a project that says nothing runs its sensors at every gate as it always did. Any other
 * value is an `error`, never read as off or as on. */
export function discoverSameTree(cwd) {
  const { declared, error } = readHarness(cwd);
  if (error) return { skip: false, error };
  if (!declared || !('sameTree' in declared)) return { skip: false };
  if (declared.sameTree === 'skip') return { skip: true };
  return { skip: false, error: `${SAME_TREE_SHAPE}; it is ${JSON.stringify(declared.sameTree)}` };
}

/** Whether the project lets the sensors of a gate's turn run in WSL2 where its machine opts in
 * (`./lib/gate-wsl.mjs`): `harness.json` `"sensorsInWsl": true`. `{ value }`, false when it says nothing,
 * or `{ value: false, error }` for a value that is not `true` or `false`. A project says it because the
 * mirror runs its suite on Linux, without `node_modules`: a suite that cannot run there must not be
 * moved by a switch file that another project's needs put on the machine. */
export function discoverSensorsInWsl(cwd) {
  const { declared, error } = readHarness(cwd);
  if (error) return { value: false, error };
  if (!declared || !('sensorsInWsl' in declared)) return { value: false };
  if (typeof declared.sensorsInWsl === 'boolean') return { value: declared.sensorsInWsl };
  return { value: false, error: `harness.json "sensorsInWsl" must be true or false; it is ${JSON.stringify(declared.sensorsInWsl)}` };
}

/** How the project runs its tests sensor with exact test selection (odd/tasks/exact-tests.md): `harness.json`
 * `"exactTests": "shadow"`, the whole suite under the tracer with what selection would have skipped counted (T3,
 * S6), or `"skip"`, only the files selection runs (T4c), the switch a project commits once S6's count holds.
 * `{ value }`, `null` when it says nothing, or `{ value: null, error }` for another value. */
export function discoverExactTests(cwd) {
  const { declared, error } = readHarness(cwd);
  if (error) return { value: null, error };
  if (!declared || !('exactTests' in declared)) return { value: null };
  if (declared.exactTests === 'shadow' || declared.exactTests === 'skip') return { value: declared.exactTests };
  return { value: null, error: `harness.json "exactTests" must be "shadow" or "skip"; it is ${JSON.stringify(declared.exactTests)}` };
}

/** The variable that runs a tests sensor of `node --test` that many test files at a time, for a machine whose
 * processors make node's default too few: GitHub's runner has 2, where the default is one fewer, 1. Node takes no
 * `--test-concurrency` in NODE_OPTIONS, so the workflow names it here (step 4 of the parallel-gate plan). */
export const TEST_CONCURRENCY_ENV = 'JS_HARNESS_TEST_CONCURRENCY';

/** `{ value }` of `TEST_CONCURRENCY_ENV` in `env`, `null` when unset, or `{ value: null, error }` for a value that
 * is not a whole number above 0: a variable set wrong fails the gate rather than run it as nobody asked. */
export function discoverTestConcurrency(env = process.env) {
  const value = env[TEST_CONCURRENCY_ENV];
  if (value === undefined) return { value: null };
  if (/^[1-9]\d*$/.test(value)) return { value: Number(value) };
  return { value: null, error: `${TEST_CONCURRENCY_ENV} must be a whole number above 0; it is ${JSON.stringify(value)}` };
}

/** `command`, a tests sensor of `node --test`, with `--test-concurrency=<concurrency>` where it is given and then
 * `files`, each through `quote`: after one `--` for the `test` script. The one place both are added, so a skip
 * gate's file list and the concurrency of step 4 never make two `--` (odd/tasks/exact-tests.md, T4c). */
function testsCommandLine(command, { concurrency = null, files = [], quote = (file) => file } = {}) {
  const added = [...(concurrency === null ? [] : [`--test-concurrency=${concurrency}`]), ...files.map(quote)];
  if (added.length === 0) return command;
  return /^npm (run )?test$/.test(command) ? `${command} -- ${added.join(' ')}` : `${command} ${added.join(' ')}`;
}

/** What the tests sensor runs when it is `npm run test` or `npm test`: the project's `test` script; else
 * the command itself. Shadow traces `node --test` alone, which finds the test files selection is asked of. */
function testsCommand(cwd, command) {
  if (!/^npm (run )?test$/.test(command)) return command;
  const script = readJson(cwd, 'package.json')?.value?.scripts?.test;
  return typeof script === 'string' ? script : command;
}

/** The folder of the traces of the repository at `cwd`, or `null` where git names none: under its common git
 * dir, one store for every worktree of it (the result memory, odd/tasks/result-memory.md), since a trace is
 * keyed by content and as true in any of them. The folder a linked worktree kept under its own git dir before
 * it is removed here, by the first gate that writes the shared one. */
function tracesDir(cwd, spawn = spawnSync) {
  try {
    const asked = spawn('git', ['rev-parse', '--absolute-git-dir', '--git-common-dir'], { cwd, encoding: 'utf8' });
    const [gitDir, common] = asked && !asked.error && asked.status === 0 ? String(asked.stdout).split(/\r?\n/).map((line) => line.trim()) : [];
    if (!gitDir || !common) return null;
    const shared = path.resolve(cwd, common);
    if (path.resolve(gitDir) !== shared) fs.rmSync(path.join(gitDir, 'js-harness', 'traces'), { recursive: true, force: true });
    return path.join(shared, 'js-harness', 'traces');
  } catch {
    return null; // no git on PATH
  }
}

/** S6's running count (odd/tasks/exact-tests.md, L14, the reading the lead adopted): of the gate log's
 * `events`, the end lines whose tests row has a shadow that would have skipped a file (`wouldSkip` above 0),
 * read in the order they ended, and how many of them are in a row since the last whose skipped files did not
 * all pass. `{ run, last }`, `last` that gate's `{ at, files }` or `null`. Thirty in a row switch the skip on. */
export function s6Count(events) {
  const ends = events.filter((event) => event?.event === 'end' && typeof event.at === 'string' && Array.isArray(event.sensors));
  ends.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  let run = 0;
  let last = null;
  for (const end of ends) {
    for (const sensor of end.sensors) {
      // A gate in skip mode (T4c) carries `skip`, never `shadow`: a file it skipped could not fail, and counting it
      // would raise the count with no proof. Its tests row is passed over here even were both ever written.
      if (sensor?.skip) continue;
      const shadow = sensor?.shadow;
      if (!shadow || !(shadow.wouldSkip > 0)) continue;
      const failed = Array.isArray(shadow.failedOfSkipped) ? shadow.failedOfSkipped : [];
      if (failed.length > 0) {
        run = 0;
        last = { at: end.at, files: failed };
      } else run += 1;
    }
  }
  return { run, last };
}

/** The gates in a row S6 asks for before the skip is switched on. */
const S6_GATES = 30;

/** The `exact tests` row of a project that says `exactTests` in harness.json: S6's running count, read from
 * the gate log of `home`. It informs only, as `payload` does: the switch is a commit of harness.json, made
 * with these numbers. A project that says nothing of `exactTests` has no row; one in skip mode (T4c) has a row that
 * says so, since its gates count nothing for S6 any more. */
export function checkExactCount(cwd, home) {
  const exact = discoverExactTests(cwd);
  if (exact.value === null) return [];
  if (exact.value === 'skip') return [{ name: 'exact tests', pass: true, detail: 'skip: on since harness.json says so; S6\'s count stopped at the switch' }];
  const { run, last } = s6Count(readGateLog(home).events);
  const since = last ? `, since the gate of ${rowTime(last.at)} where ${last.files.join(', ')} failed` : '';
  return [{ name: 'exact tests', pass: true, detail: `S6: ${run} of ${S6_GATES} gates in a row would have skipped a test file and saw none of those fail${since}; the skip is switched on at ${S6_GATES}` }];
}

/** `iso` as a row says it: the local day and time, to the minute. */
function rowTime(iso) {
  const at = new Date(iso);
  const two = (number) => String(number).padStart(2, '0');
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}`;
}

/** The one row of a gate that ran no sensor because another gate ran them on the same tree and all
 * passed: which `sensors` did not run, and the gate that is the proof (`provenBy`), by the id of its
 * lines in the gate log, when it ended and, where the log still says it, in which folder. */
function sameTreeRow(sensors, proof) {
  const where = proof.cwd ? ` in ${proof.cwd}` : '';
  return {
    name: 'sensors',
    pass: true,
    info: true,
    detail: `no sensor ran (${sensors.map((sensor) => sensor.name).join(', ')}): this tree is the one gate ${proof.id.slice(0, 8)} passed on ${rowTime(proof.at)}${where}, file for file (harness.json "sameTree")`,
  };
}

// How many paths a row that lists paths of the repository names (the staged documents of a gate that ran
// no sensor, the untracked paths that appeared while the sensors ran); the rest are counted.
const PATHS_NAMED = 10;

/** `paths` as the lines under a row: the first `PATHS_NAMED` of them, and how many more there are. A name
 * with a control character in it is shown as JSON: it comes from the repository, and a line break in it
 * would read as another row of the report. */
function namedPaths(paths) {
  const named = paths.slice(0, PATHS_NAMED).map((file) => (/\p{Cc}/u.test(file) ? JSON.stringify(file) : file));
  const more = paths.length - named.length;
  return [...named, ...(more > 0 ? [`and ${more} more`] : [])];
}

/** The first row of a gate that ran none of the project's `sensors` because the commit holds documents
 * alone: which did not run, and for which staged `paths` (`namedPaths`). With `quick`, the sensors of
 * documents that ran in their place (`discoverDocumentSensors`), it names those as well, and says that
 * no gate lock was taken for them; their own rows follow this one. */
function documentsRow(sensors, { paths, side }, quick = []) {
  const staged = side
    ? (paths.length === 1 ? `the one path this commit changes against ${side} is a document` : `all ${paths.length} paths this commit changes against ${side} are documents`)
    : (paths.length === 1 ? 'the one staged path is a document' : `all ${paths.length} staged paths are documents`);
  const declared = `${staged} declared in harness.json "documents"`;
  const names = (list) => list.map((sensor) => sensor.name).join(', ');
  let detail = `no sensor ran (${names(sensors)}): ${declared}`;
  if (quick.length > 0) {
    detail = sensors.length > 0
      ? `the sensors did not run (${names(sensors)}): ${declared}; its "documentSensors" ran in their place (${names(quick)}), with no gate lock taken`
      : `${declared}: its "documentSensors" ran (${names(quick)}), with no gate lock taken`;
  }
  return { name: 'sensors', pass: true, info: true, detail, lines: namedPaths(paths) };
}

/** One row per sensor of documents, run one after another as the sensors are (`checkSensor`), each for
 * `DOCUMENT_SENSOR_TIMEOUT_MS` at most, or for the shorter time a caller gives every sensor. One whose time
 * ran out says where a longer check belongs. `held` is whether the gate was started in a turn at the
 * machine's gate lock, which a sensor is told (`GATE_HELD_ENV`). */
async function documentSensorRows(cwd, quick, deps, held) {
  const sensorTimeout = Math.min(deps.sensorTimeout ?? DOCUMENT_SENSOR_TIMEOUT_MS, DOCUMENT_SENSOR_TIMEOUT_MS);
  const rows = [];
  for (const sensor of quick) {
    const row = await checkSensor(cwd, sensor, { ...deps, sensorTimeout, gateHeld: held });
    rows.push(row.timedOut
      ? { ...row, detail: `${row.detail}; a sensor of documents runs with no gate lock taken, so it is a check of seconds: a longer one belongs in "sensors"` }
      : row);
  }
  return rows;
}

/** The untracked paths of the repository `cwd` is in, as git lists them from its top and one for each file
 * (`--untracked-files=all`: a folder that appears is named by what is in it), or `null` whenever git does
 * not say: no git, no work tree, a command that fails. What the project ignores is not listed.
 *
 * Asked with none of the variables that bind git to one repository (`GIT_LOCAL_ENV`), unlike what is
 * staged (`stagedDocuments`): that question is about the commit, whose index a hook is handed, and this one
 * about the folder the sensors run in, which are given none of those variables either (`checkSensor`). With
 * them, a `check --cwd <another project>` started by a hook would hold that project's files against the
 * index of the hook's repository. And with `--no-optional-locks`: `git status` writes the index it has
 * refreshed when it can, and this runs beside the commit that holds that index.
 *
 * The entries are ended by a NUL and read as they come (`-z`). A rename or a copy is two of them, the
 * second the name the path had, with no status before it, so it is passed over and never read as an entry.
 *
 * The question is bounded (`TREE_TIMEOUT_MS`): it is asked twice inside the gate's turn, so while the
 * machine's gate lock is held, and a git that does not return (a file system monitor that hangs, a tree of
 * untracked files too large to walk) would hold that gate and every gate behind it with no row to say why.
 * Past the bound git is ended and did not say, like a git that failed: the row only informs.
 * `spawn` stands in for `spawnSync`. */
function untrackedPaths(cwd, spawn = spawnSync) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !GIT_LOCAL_ENV.includes(key.toUpperCase())));
  let result;
  try {
    result = spawn('git', ['--no-optional-locks', 'status', '--porcelain', '-z', '--untracked-files=all'], { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: TREE_TIMEOUT_MS });
  } catch {
    return null; // no git on PATH
  }
  if (!result || result.error || result.status !== 0 || typeof result.stdout !== 'string') return null;
  const paths = new Set();
  const entries = result.stdout.split('\0');
  for (let at = 0; at < entries.length; at += 1) {
    const entry = entries[at];
    if (entry.startsWith('?? ')) paths.add(entry.slice(3));
    else if (/^(?:[RC].|.[RC]) /.test(entry)) at += 1;
  }
  return paths;
}

/** The row named `tree` of a gate whose sensors left something in the working tree: the untracked paths
 * that are in `after` and were not in `before` (`untrackedPaths`, asked before the first sensor and after
 * the last). No row when none appeared, or when git did not say either time: a tree that could not be
 * looked at is not one that is clean, and is not said to be.
 *
 * It informs and fails nothing. A test that writes into the folder it runs in leaves a file the next
 * commit finds untracked, with nothing to say where it came from: a gate once left
 * `Microsoft/Windows/PowerShell/ModuleAnalysisCache` in its tree. A gate that prints no such row is the
 * proof that its sensors left nothing. */
function treeRows(before, after) {
  if (!before || !after) return [];
  const appeared = [...after].filter((file) => !before.has(file));
  if (appeared.length === 0) return [];
  const [paths, them] = appeared.length === 1 ? ['1 untracked path', 'it'] : [`${appeared.length} untracked paths`, 'them'];
  return [{ name: 'tree', pass: true, info: true, detail: `${paths} appeared in the working tree while the sensors ran (a test may have written ${them})`, lines: namedPaths(appeared) }];
}

/** The row that names what the sensors left in their WSL2 mirror (`leftPaths` of `./lib/gate-wsl.mjs`),
 * as `treeRows` names what appeared in the Windows tree: the suite writes into the mirror, so a test that
 * litters the tree is seen there. None when nothing was left or nothing ran there. */
function mirrorRows(ran) {
  const left = ran.flatMap((row) => row.left ?? []);
  if (left.length === 0) return [];
  const [paths, them] = left.length === 1 ? ['1 path', 'it'] : [`${left.length} paths`, 'them'];
  return [{ name: 'tree', pass: true, info: true, detail: `${paths} appeared in the WSL2 mirror while the sensors ran (a test may have written ${them})`, lines: namedPaths(left) }];
}

// Once the shell has exited, the pipes should close at once; a grandchild that kept them open (a
// daemon a script left behind) must not hold the gate, so we stop waiting for them after this.
const PIPE_GRACE_MS = 2000;
const SENSOR_OUTPUT_LIMIT = 64 * 1024 * 1024;

/** Runs `command` through the shell and resolves to a `spawnSync`-shaped `{ status, signal, stdout,
 * stderr, error? }`. Past `timeout` ms it kills the whole process tree and reports `error.code ===
 * 'ETIMEDOUT'`. Whatever still holds the pipes after the shell exited is killed too; the result keeps the
 * shell's own status. Output beyond 64 MiB per stream is dropped, so a noisy command is never ENOBUFS.
 *
 * `spawnSync`'s own timeout would kill only the shell, and the real command (`node` behind `cmd.exe`, `npm`
 * behind `sh`) would keep running after every commit. What is killed is found by `bin/lib/process-tree.mjs`,
 * which on Windows needs to know when the shell started and exited (a pid alone does not name its children).
 * A kill that could not be done is reported as `sweepError` on the result, never thrown out of a timer.
 * `killTree` and `killSurvivors` are injectable.
 *
 * With `inherit` the command is given this process's own input and output instead of pipes, so what it
 * prints reaches the caller as it prints it and `stdout` and `stderr` come back empty: that is for
 * `js-harness gate`, which runs a command for whoever started it and reports nothing itself. A `timeout`
 * of 0 is no time bound.
 *
 * `silence` (ms) bounds the stretch with no output instead: each chunk the command writes restarts it, and
 * past it the tree is killed as at `timeout`, the error then saying `silent: true`. It needs the pipes, so
 * with `inherit` it does nothing; 0 or none is no such bound. */
export function runSensor(command, { cwd, env, timeout, silence = 0, inherit = false, killTree: tree = killTree, killSurvivors: survivors = killSurvivors, spawn: start = spawnChild }) {
  return new Promise((resolve) => {
    const out = { stdout: '', stderr: '' };
    let child;
    const startedAt = Date.now(); // before the spawn: the shell cannot have been created earlier
    try {
      child = start(command, { cwd, env, shell: true, windowsHide: true, detached: process.platform !== 'win32', stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ status: null, signal: null, ...out, error });
      return;
    }
    let exitedAt;
    let sweepError;
    const stop = (kill) => {
      try {
        kill(child, { startedAt, ...(exitedAt !== undefined && { exitedAt }) });
      } catch (error) {
        sweepError ??= error;
      }
    };
    // On POSIX the sensor leads its own process group, so a Ctrl-C at the terminal no longer reaches
    // it: pass the signal on by killing the group, then let it end check as it would have.
    const signals = process.platform === 'win32' ? [] : ['SIGINT', 'SIGTERM', 'SIGHUP'];
    const forward = (signal) => {
      stop(tree);
      for (const name of signals) process.removeListener(name, forward);
      process.kill(process.pid, signal);
    };
    for (const name of signals) process.once(name, forward);
    let timedOut = false;
    let silent = false;
    let exit = { status: null, signal: null };
    let done = false;
    let timer;
    let quiet;
    let grace;
    const finish = (extra) => {
      if (done) return;
      done = true;
      for (const name of signals) process.removeListener(name, forward);
      clearTimeout(timer);
      clearTimeout(quiet);
      clearTimeout(grace);
      child.stdout?.destroy();
      child.stderr?.destroy();
      const timedOutError = () => (silent
        ? Object.assign(new Error(`wrote nothing for ${silence} ms`), { code: 'ETIMEDOUT', silent: true })
        : Object.assign(new Error(`timed out after ${timeout} ms`), { code: 'ETIMEDOUT' }));
      const error = extra ?? (timedOut ? timedOutError() : undefined);
      resolve({ ...exit, ...out, ...(error && { error }), ...(sweepError && { sweepError: sweepError.message }) });
    };
    // Kills the tree for a time that ran out, the silence's or the whole run's, whichever came first. The decision
    // waits one turn of the loop: an exit the system already holds is delivered after the timers, so a command that
    // ended as its time ran out is reported by its exit, not as a timeout (first-version T6h, JH 25's verifier).
    let chunks = 0;
    const outOfTime = (bySilence) => {
      if (timedOut || exitedAt !== undefined) return;
      const seen = chunks;
      setImmediate(() => {
        if (done || timedOut || exitedAt !== undefined || (bySilence && chunks !== seen)) return;
        kill(bySilence);
      });
    };
    const kill = (bySilence) => {
      timedOut = true;
      silent = bySilence;
      clearTimeout(timer);
      clearTimeout(quiet);
      stop(tree);
      // The shell may already be gone with a survivor holding the pipes; do not wait on them for long.
      grace = setTimeout(() => finish(), PIPE_GRACE_MS);
    };
    // The silence starts with the command and again at each chunk it writes; never with `inherit`.
    const listen = silence > 0 && !inherit ? () => {
      clearTimeout(quiet);
      quiet = setTimeout(() => outOfTime(true), silence);
    } : () => {};
    // No pipe to read when the command writes to this process's own output.
    for (const stream of inherit ? [] : ['stdout', 'stderr']) {
      child[stream].setEncoding('utf8');
      child[stream].on('data', (chunk) => {
        chunks += 1;
        if (out[stream].length < SENSOR_OUTPUT_LIMIT) out[stream] += chunk;
        if (!timedOut && exitedAt === undefined) listen();
      });
    }
    listen();
    child.on('error', (error) => finish(error));
    child.on('exit', (status, signal) => {
      exit = { status, signal };
      exitedAt = Date.now();
      clearTimeout(timer);
      clearTimeout(quiet);
      clearTimeout(grace);
      // Pipes still open this long after the shell exited: a descendant holds them. Kill it, or a test
      // server the script started would run on after every commit.
      grace = setTimeout(() => {
        stop(survivors);
        finish();
      }, PIPE_GRACE_MS);
    });
    child.on('close', () => finish());
    if (timeout > 0) timer = setTimeout(() => outOfTime(false), timeout);
  });
}

/** The mark of a held gate lock: a process that holds the machine's gate lock (`./lib/gate-lock.mjs`)
 * gives `JS_HARNESS_GATE_HELD=1` to what it runs, `check` to its sensors and `js-harness gate` to its
 * command. A `check` or a `js-harness gate` that starts with the mark takes no lock and runs at once
 * what it has to run: its parent holds the lock, and waiting for it would be waiting for itself, which
 * is what `js-harness gate -- npm run check` did, for the whole of its wait, before there was a mark.
 *
 * It is not `JS_HARNESS_CHECK_INNER`, which says "a gate's sensor runs you, so run no sensor": a `check`
 * that has only this mark runs its sensors, since nobody runs them for it.
 *
 * The mark is safe to trust because a child of a holder runs inside its turn: the holder waits for what
 * it started and beats while it does, so the lock is held for as long as that child runs, and what the
 * child starts is part of the one heavy run the turn was taken for. It is given only with the lock in
 * hand, never by a gate that runs without it (a lock that could not be taken).
 *
 * What it cannot protect against: a mark set by hand, which turns the lock off for that process and all
 * it starts; a process that outlives the holder that started it (left in the background, detached),
 * which keeps the mark after the turn is over; and a holder that lost its lock to another gate for
 * having been silent a whole minute, whose children still carry it. `check` says in a row that it ran
 * under the mark, and `gate` in a line on stderr, so a mark that should not have been there shows. */
export const GATE_HELD_ENV = 'JS_HARNESS_GATE_HELD';

/** Runs one sensor's command in `cwd` through the shell and reports pass/fail. `spawn` may return a
 * plain result or a promise of one, so a test can stub it with either. `gateHeld` says that the gate
 * which runs this sensor does so inside a turn at the machine's gate lock, its own or the one of the
 * process that started it: the sensor is then given the mark of a held lock (`GATE_HELD_ENV`), and
 * otherwise never has it, whatever this process was given.
 *
 * Beside what a row prints, the result says how long the command took (`seconds`, to a tenth) and
 * whether its time ran out (`timedOut`), which is what the gate log keeps of a sensor.
 * `platform` stands in for the system this runs on, for the one variable that is set on Windows alone.
 *
 * With `wsl` (`{ distro, node }`, the machine's switch file) on Windows, the command runs in that WSL2
 * distribution from a mirror of the tree (`./lib/gate-wsl.mjs`), and the row carries `ranIn: 'wsl'`; one
 * that never reached the mirror runs here, and its row says why. `wslPath` stands in for `toWslPath`. */
/** How many names of failing tests a gate's end line keeps for one sensor, and how long each may be. */
const FAILING_KEPT = 20;
const FAILING_NAME_MAX = 200;

/** The names of the tests that failed, read from what a `node --test` printed: the lines under its
 * `✖ failing tests:` (the spec reporter, a run's default when its output is no terminal), each without
 * the time after it, or else the top-level `not ok <n> - <name>` of the tap reporter. Colours are taken
 * off, each name is kept once, twenty at most and two hundred characters each. None for an output of any
 * other kind: the gate keeps what it can read, and a sensor's own report stays where it is. A WSL2 run's
 * output lives only in the mirror and the report, and on 2026-10-14 the name of a failing test could not be
 * had back once the report was gone (odd/tasks/gate-log-failing-tests.md). */
export function failingTests(output) {
  const lines = String(output ?? '').replace(/\u001b\[[0-9;]*m/g, '').split(/\r?\n/);
  const under = lines.findIndex((line) => line.trim() === '✖ failing tests:');
  const names = under === -1
    ? lines.map((line) => /^not ok \d+ - (.+)$/.exec(line)?.[1]).filter(Boolean)
    : lines.slice(under + 1).map((line) => /^✖ (.+?)(?: \([\d.]+m?s\))?$/.exec(line)?.[1]).filter(Boolean);
  return [...new Set(names.map((name) => name.trim().slice(0, FAILING_NAME_MAX)))].slice(0, FAILING_KEPT);
}

export async function checkSensor(cwd, sensor, { spawn = runSensor, sensorTimeout = SENSOR_TIMEOUT_MS, sensorSilence = SENSOR_SILENCE_MS, gateHeld = false, platform = process.platform, wsl = null, wslPath = toWslPath, traces = null, wslNode = wslNodeVersion, concurrency = null, ci = onCi(process.env) } = {}) {
  // The command runs against a throwaway home, so a test that forgets `--home` cannot write into
  // the real one — that happened once, and a rule in prose would not have stopped it.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-test-home-'));
  // Windows PowerShell keeps its cache of analysed modules under the local application data folder of the
  // profile, and with `USERPROFILE` moved to a home that holds no such folder it has none to name: the
  // cache then goes to `Microsoft/Windows/PowerShell/ModuleAnalysisCache` under the folder PowerShell runs
  // in, which is the working tree the gate checks. Seen on 2026-10-11 with Windows PowerShell 5.1 in an
  // empty folder: `[Environment]::GetFolderPath("LocalApplicationData")` answered an empty text, whatever
  // `LOCALAPPDATA` said, and the cache was in that folder once PowerShell had lived some thirteen seconds
  // past a command that made it analyse modules, which is why no short test ever left it; with this
  // variable set the folder stayed empty and the cache was the file it names.
  // So the cache is given a path of its own, a file of the
  // throwaway home, which is there while the sensor runs and goes with it. On Windows alone: elsewhere
  // PowerShell keeps that cache under `HOME`, which is the throwaway one already, and a variable set on
  // every system would be one more thing a sensor's environment differs by for nothing.
  const powershellCache = platform === 'win32' && { PSModuleAnalysisCachePath: path.join(home, 'PSModuleAnalysisCache') };
  // npm keeps its cache and logs under %LOCALAPPDATA% on Windows, not under HOME, so `npm run` is
  // pointed into the throwaway home as well.
  const overrides = { JS_HARNESS_CHECK_INNER: '1', HOME: home, USERPROFILE: home, npm_config_cache: path.join(home, '.npm-cache'), ...powershellCache, ...(gateHeld && { [GATE_HELD_ENV]: '1' }) };
  // NODE_TEST_CONTEXT is set when check itself runs under `node --test`; the nested runner would act
  // as a child and skip files. Every case variant of an override goes too: Windows keeps the
  // uppercase one of two keys that differ only in case, and npm reads either.
  // Git's repository variables go as well: with the `GIT_DIR` a hook exports, a sensor's own `git init`
  // in a temp directory acts on the repository being committed to, and once left it bare.
  // The mark of a held lock goes whenever it is not given above: the one this process carries is its
  // parent's word, and a gate that runs its sensors without the lock must not pass it on.
  // The variable of the tests' concurrency is check's, read above: a test of check in the suite must not see it, nor
  // the merge hook's mark, with which the suite's tests of the commit-size row would read every commit as a merge's.
  const replaced = new Set([...Object.keys(overrides), GATE_HELD_ENV, TEST_CONCURRENCY_ENV, MERGE_HOOK_ENV, 'NODE_TEST_CONTEXT', ...GIT_LOCAL_ENV].map((key) => key.toLowerCase()));
  const inherited = Object.entries(process.env).filter(([key]) => !replaced.has(key.toLowerCase()));
  const env = { ...Object.fromEntries(inherited), ...overrides };
  // The tests sensor in shadow (odd/tasks/exact-tests.md, T3, S6): the whole suite runs under the tracer, and
  // the selection is asked first, so the row can say what it would have skipped and which of those failed.
  // In WSL2 (T3b) the tracer runs in the mirror: the runner sets its variables, the traces of that place have a
  // folder of their own, and selection is asked with the node, the system and the variables there. A node that
  // cannot be asked, or a tree WSL does not mount, runs no shadow, and in skip mode the whole suite.
  // `concurrency` is step 4's `--test-concurrency`, given where the suite is `node --test` (`checkSensors`).
  const inWsl = Boolean(wsl?.distro && platform === 'win32');
  const exact = sensor.name === 'tests' && Boolean(traces?.dir);
  const started = exact ? (inWsl ? wslShadow(cwd, traces.dir, { wsl, wslPath, wslNode }) : startShadow(cwd, path.join(traces.dir, platform === 'win32' ? 'windows' : platform), { env })) : null;
  // Skip mode (T4c, `"exactTests": "skip"`): the same start, traced as in shadow, but only selection's `run` files
  // run (`skipPlan`), so they refresh their traces, and the row counts what was skipped, never as a shadow.
  const skipping = exact && traces.mode === 'skip';
  const shadow = skipping ? null : started;
  const plan = skipping ? skipPlan(started, cwd, sensor.command, concurrency, ci) : null;
  // The command as written, which the row says, and the one that runs: with the files to run after it.
  const written = testsCommandLine(sensor.command, { concurrency });
  const asked = plan?.files ? testsCommandLine(sensor.command, { concurrency, files: plan.files }) : written;
  let result;
  // Where the machine opted in (`wsl`, on Windows alone), the sensor runs first in WSL2 from a mirror of
  // the tree (`wslRoute`). It runs on Windows instead where it never reached the mirror, and `fellBack`
  // then says why; a sensor that reached it and failed there failed.
  let ranIn;
  let fellBack;
  const startedAt = Date.now();
  try {
    // In WSL2 the files to run are words of the runner's sh, quoted inside the word of the whole command.
    const mirrored = { ...sensor, command: plan?.files ? testsCommandLine(sensor.command, { concurrency, files: plan.files, quote: bashWord }) : written };
    // A run of no file starts nothing, here or in WSL2: every test file is proven by a stored passing trace.
    const route = !plan?.none && wsl?.distro && platform === 'win32' ? wslRoute(cwd, home, mirrored, { wsl, wslPath, gateHeld, sensorTimeout, trace: started?.mounted }) : null;
    if (plan?.none) {
      result = { status: 0, signal: null, stdout: '', stderr: '' };
    } else if (route?.command) {
      result = await spawn(route.command, { cwd, env, timeout: sensorTimeout, silence: sensorSilence });
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
      const synced = syncedMs(output);
      if (synced !== null) ranIn = { distro: wsl.distro, synced };
      // A bound that ran out before the mark is a mirror never reached, like any other: the suite never ran.
      else if (result.error?.code === 'ETIMEDOUT') fellBack = result.error.silent ? `it wrote nothing for ${sensorSilence / 1000} s before the mirror was synced` : 'its time ran out before the mirror was synced';
      else fellBack = notReached(output, result);
      // The bound inside the distribution is a little short of this one, and stops the command first:
      // what the runner says of it is a time that ran out, as this one is (Codex, 2026-10-14).
      // Beside `timeout`'s own exit status and alone on its line: a test may print the mark, and a sensor
      // that passed is never a timeout (Codex, 2026-10-14).
      if (ranIn && !result.error && result.status === 124 && output.split(/\r?\n/).includes(TIMED_OUT_MARK)) {
        result = { ...result, error: Object.assign(new Error(`timed out after ${sensorTimeout} ms in WSL2`), { code: 'ETIMEDOUT' }) };
      }
    } else if (route) {
      fellBack = route.why;
    }
    // A suite of the mirror that falls back runs whole on Windows, untraced: its selection was asked of the
    // traces of WSL2, which say nothing of this place.
    if (!ranIn && !plan?.none) result = await spawn(route ? written : asked, { cwd, env, timeout: sensorTimeout, silence: sensorSilence });
  } finally {
    // Best effort: on Windows a survivor can still hold the home as its cwd, and that must not fail check.
    try {
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // left behind in the temp directory
    }
  }
  const seconds = Math.round((Date.now() - startedAt) / 100) / 10;
  const { name } = sensor;
  const command = written;
  const pass = !result.error && result.status === 0;
  const timedOut = result.error?.code === 'ETIMEDOUT';
  let detail = `${command} passed`;
  if (timedOut) detail = result.error.silent ? `${command} wrote nothing for ${sensorSilence / 1000} s and was stopped` : `${command} timed out after ${sensorTimeout / 1000} s`;
  else if (result.error) detail = `${command} could not run: ${result.error.message}`;
  else if (result.status === null && result.signal) detail = `${command} was killed by ${result.signal}`;
  else if (!pass) detail = `${command} exited ${result.status}`;
  if (ranIn) detail += pass && ranIn.synced !== null ? ` in WSL2 (${ranIn.distro}, its mirror synced in ${(ranIn.synced / 1000).toFixed(1)} s)` : ` in WSL2 (${ranIn.distro})`;
  else if (fellBack) detail += ` on Windows: WSL2 did not run it (${fellBack})`;
  else if (wsl?.windows && platform === 'win32') detail += ` on Windows (${wsl.windows}=0), its temporary files under ${os.tmpdir()}`;
  // The verdict is the command's own; a leftover that could not be stopped is said, not hidden, and does not fail it.
  if (result.sweepError) detail += `; could not stop what it left running: ${result.sweepError}`;
  // Keep the runner's own report, even what it printed before a spawn error such as ENOBUFS, so a
  // red row says which test failed, not just that one did.
  const left = ranIn ? leftPaths(`${result.stdout ?? ''}${result.stderr ?? ''}`) : [];
  // Each test file's seconds, for the throughput review (odd/tasks/throughput-review.md, B5), read before the
  // results go, in shadow and in skip mode alike. A suite of the mirror that fell back ran untraced: it has none.
  const times = started && !(started.mounted && !ranIn) ? testTimesOf(started.results) : [];
  // A suite of the mirror that fell back to Windows ran untraced: it says nothing of what was skipped.
  const shadowed = shadow && !(shadow.mounted && !ranIn) ? endShadow(shadow) : null;
  if (started && !shadowed) fs.rmSync(started.results, { recursive: true, force: true });
  if (shadowed) {
    const { files, wouldSkip, failedOfSkipped } = shadowed;
    detail += `; shadow: ${wouldSkip.length} of ${files} test files would have been skipped`;
    if (failedOfSkipped.length > 0) detail += `, and ${failedOfSkipped.length} of them did not pass: ${failedOfSkipped.join(', ')}`;
  }
  // Skip mode's count: of the test files, how many did not run. A suite of the mirror that fell back ran whole.
  const whole = plan && (plan.whole ?? (fellBack && plan.files ? 'it ran on Windows, where selection asked the traces of WSL2' : null));
  const skip = plan && { files: plan.tests, skipped: whole ? 0 : plan.none ? plan.tests : plan.tests - plan.files.length };
  if (plan?.none) detail = `${command} ran no test file; exact tests: skipped all ${plan.tests} test files, each proven by a stored passing trace`;
  else if (whole) detail += `; exact tests: the whole suite ran, since ${whole}`;
  else if (plan) detail += `; exact tests: skipped ${skip.skipped} of ${skip.files} test files`;
  // A run of none in WSL2 is proven by the traces of the mirror, the place its tree key names (`checkSensors`).
  const provenIn = ranIn || (plan?.none && inWsl);
  return { name, pass, detail, ...(shadowed && { shadow: shadowed }), ...(skip && { skip }), output: pass ? '' : `${result.stdout ?? ''}${result.stderr ?? ''}`, seconds, timedOut, ...(provenIn && { ranIn: 'wsl' }), ...(left.length > 0 && { left }), ...(times.length > 0 && { times }) };
}

/** The seconds of each test file a traced suite ran, from the tracer's results (`trace-reads.cjs`): `[{ test,
 * seconds }]`, none where the folder cannot be read, a result cut short or with no time left out. */
function testTimesOf(results) {
  const times = [];
  try {
    for (const name of fs.readdirSync(results)) {
      try {
        const { test, seconds } = JSON.parse(fs.readFileSync(path.join(results, name), 'utf8'));
        if (typeof test === 'string' && Number.isFinite(seconds)) times.push({ test, seconds });
      } catch {
        // a result cut short
      }
    }
  } catch {
    // no file ended, or the folder cannot be read
  }
  return times.sort((a, b) => a.test.localeCompare(b.test));
}

/** Characters a test file's path may hold to be named on the command line of a skip gate: node takes each
 * argument of `--test` as a glob, and cmd.exe cannot quote `%`, so any other runs the whole suite instead. */
const PLAIN_PATH = /^[A-Za-z0-9._/-]+$/;

/** The longest command line a skip gate names its files on: cmd.exe takes 8191 characters, and the bound is
 * kept below it on every system, so a selection runs the same way wherever it is asked. */
const COMMAND_LINE_MAX = 7000;

/** Whether `env` says the gate runs on CI: CircleCI and GitHub Actions both set `CI`, and a `CI` of `false`
 * or `0` says it does not. */
export function onCi(env) {
  const value = env.CI?.trim().toLowerCase();
  return Boolean(value) && value !== 'false' && value !== '0';
}

/** What a tests sensor in skip mode runs (odd/tasks/exact-tests.md, T4c), from `started`, the selection
 * `startShadow` asked (`null` where WSL2's could not be asked): `{ tests, files }`, the files to run; `{ tests,
 * none: true }`, none; or `{ tests, whole }`, why the whole suite runs instead, traced as in shadow. `tests` is
 * the count of the test files. On CI (`ci`), the whole suite runs. */
function skipPlan(started, cwd, command, concurrency, ci) {
  // The merge queue's candidate run on CI checks the tree a fresh checkout gives, which is what lands: it
  // runs every test file (odd/tasks/exact-tests.md, L18).
  if (ci) return { tests: started?.tests.length ?? testFilesOf(path.resolve(cwd)).length, whole: 'a CI run runs the whole suite (the CI variable is set)' };
  if (!started) return { tests: testFilesOf(path.resolve(cwd)).length, whole: 'the node of WSL2 said no version, or WSL mounts no folder of its traces' };
  const { tests, run, full } = started;
  const of = { tests: tests.length };
  if (full) return { ...of, whole: full };
  if (tests.length === 0) return { ...of, whole: 'no test file was found' };
  const odd = run.find((file) => !PLAIN_PATH.test(file));
  if (odd !== undefined) return { ...of, whole: `${JSON.stringify(odd)} holds a character outside [A-Za-z0-9._/-]` };
  const dashed = run.find((file) => file.startsWith('-'));
  if (dashed !== undefined) return { ...of, whole: `${JSON.stringify(dashed)} starts with a dash, which node would read as an option` };
  // npm runs pretest and posttest around the test script; a run of no file would run neither, and no trace
  // proves them (Codex, 2026-10-15). With files, npm runs them as ever.
  const scripts = /^npm /.test(command) ? readJson(cwd, 'package.json')?.value?.scripts ?? {} : {};
  if (run.length === 0 && ('pretest' in scripts || 'posttest' in scripts)) return { ...of, whole: 'package.json has a pretest or posttest script, which no trace proves' };
  if (run.length === 0) return { ...of, none: true };
  if (testsCommandLine(command, { concurrency, files: run }).length > COMMAND_LINE_MAX) return { ...of, whole: `its command line would pass ${COMMAND_LINE_MAX} characters` };
  return { ...of, files: run };
}

/** The start of a tests sensor in shadow: the selection asked of the traces in `dir`, under `place` (the
 * node, system and variables of where the suite runs, this process's by default), and `env` given the tracer
 * where given, with a results folder each test file writes how it ended into, a file of its own. Selection's
 * `run` (the files the flaky ledger names among them) and `full`, the reason the whole suite runs or `null`,
 * are what a gate in skip mode runs (T4c). */
function startShadow(cwd, dir, { env = null, place = {} } = {}) {
  const root = path.resolve(cwd);
  const tests = testFilesOf(root);
  const { run, skipped, full } = selectTests({ tests, readTraces: (one) => readTraces(dir, one), stateOf: (key) => stateOf(root, key), flaky: flakyTestsOf(root), ...place });
  fs.mkdirSync(dir, { recursive: true });
  const results = path.join(dir, `results-${process.pid}-${Date.now()}`);
  if (env) Object.assign(env, traceEnv({ root, dir, results, existing: env.NODE_OPTIONS }));
  return { tests, run, skipped, full, results };
}

/** A shadow of the mirror in `wsl.distro`: its traces under `dir/wsl-<distro>`, the selection asked with the
 * version that distribution's node says and the runner's variables, and `mounted`, the folder and results folder
 * as the runner names them; `null` where the node says no version or WSL mounts neither path. */
function wslShadow(cwd, dir, { wsl, wslPath, wslNode }) {
  const node = wslNode(wsl.distro, wsl.node);
  if (!node) return null;
  const own = path.join(dir, `wsl-${wsl.distro}`);
  const shadow = startShadow(cwd, own, { place: { node, os: 'linux', env: traceEnvOf(RUNNER_ENV) } });
  const mounted = { dir: wslPath(own), results: wslPath(shadow.results), preload: wslPath(TRACE_PRELOAD) };
  if (Object.values(mounted).includes(null)) return null;
  return { ...shadow, mounted };
}

/** What the gate log's end line keeps of a shadow: the count of the files selection would have skipped, and
 * the names of those of them that did not pass, the count S6 reads (zero over at least 30 gates). */
const shadowCounts = ({ files, wouldSkip, failedOfSkipped }) => ({ files, wouldSkip: wouldSkip.length, failedOfSkipped });

/** The end of it: `{ files, wouldSkip, failedOfSkipped }`, the files that selection would have skipped and
 * those of them that did not pass: whose run ended with a code other than 0, or left no end at all (killed,
 * timed out, or a result that cannot be read), since a run not seen to pass is no evidence for S6
 * (Codex, 2026-10-14). The results folder goes. */
function endShadow({ tests, skipped, results }) {
  const passed = new Set();
  try {
    for (const name of fs.readdirSync(results)) {
      try {
        const ended = JSON.parse(fs.readFileSync(path.join(results, name), 'utf8'));
        if (ended.code === 0) passed.add(ended.test);
      } catch {
        // a result cut short: its file is not seen to pass
      }
    }
  } catch {
    // no file ended, or the folder cannot be read: none is seen to pass
  }
  fs.rmSync(results, { recursive: true, force: true });
  return { files: tests.length, wouldSkip: skipped, failedOfSkipped: skipped.filter((one) => !passed.has(one)) };
}

/** How one sensor runs in WSL2: `{ command }`, the command that runs the runner script it wrote into the
 * sensor's throwaway `home`, or `{ why }` where it cannot run there. `wslPath` stands in for `toWslPath`. */
function wslRoute(cwd, home, sensor, { wsl, wslPath, gateHeld, sensorTimeout, trace = null }) {
  const tree = path.resolve(cwd);
  const source = wslPath(tree);
  if (source === null) return { why: `${tree} is on no drive letter WSL mounts` };
  const runner = path.join(home, 'gate-wsl.sh');
  const mounted = wslPath(runner);
  if (mounted === null) return { why: `${runner} is on no drive letter WSL mounts` };
  fs.writeFileSync(runner, runnerScript({ source, mirror: mirrorName(tree), node: wsl.node, command: sensor.command, held: gateHeld, heldVariable: GATE_HELD_ENV, seconds: innerSeconds(sensorTimeout), trace }));
  return { command: wslCommand(wsl.distro, mounted) };
}

/** Why a sensor sent to WSL2 never reached its mirror: the first line `wsl.exe` printed, which it may
 * print in UTF-16 (its NUL bytes go), else how it ended. */
function notReached(output, result) {
  const line = output.replace(/\0/g, '').split(/\r?\n/).map((text) => text.trim()).find(Boolean);
  if (line) return line.length > 200 ? `${line.slice(0, 200)}…` : line;
  return result.error ? result.error.message : `wsl.exe exited ${result.status}`;
}

/** `ms` as a person reads a wait: `45 s`, `3 min 12 s`. */
function duration(ms) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

/** The bound of a wait as `--wait` takes it: `1 minute`, `2.5 minutes`. */
const minutes = (count) => `${count} minute${count === 1 ? '' : 's'}`;

/** A gate for a message: the folder it checks, with its pid and `since`, a time with the word for it,
 * where its file says them, and the ticket it goes first by, with why, where it claimed one. A gate of whom
 * nothing is known is "another gate". */
function gateSaid(gate, since) {
  const ticket = typeof gate?.first === 'string' && `first by ticket ${gate.first}: ${gate.firstReason ?? 'no reason read'}`;
  const said = [gate?.pid != null && `pid ${gate.pid}`, since, ticket].filter(Boolean);
  return `${gate?.cwd == null ? 'another gate' : `the gate of ${gate.cwd}`}${said.length ? ` (${said.join(', ')})` : ''}`;
}

/** The gate a holder of the lock is, for a message, with when it took the lock. A holder of whom nothing
 * is known (a file that could not be read, a lock folder that could not be listed) is "another gate", and
 * so is a holder a refusal did not name. */
const gateOf = (holder) => gateSaid(holder, holder?.startedAt != null && `started ${holder.startedAt}`);

/** The gate that waits ahead of this one in the line for the lock, for a message, with since when it
 * waits. It holds nothing, and is never named with the words of a holder. */
const waitingGateOf = (gate) => gateSaid(gate, gate?.waitingSince != null && `waiting since ${gate.waitingSince}`);

/** How many gates are before this one, said at the end of a line about a wait when the gate that line
 * names is not the only one. */
const aheadSaid = (line) => (line?.ahead > 1 ? `; ${line.ahead} gates are ahead of this one, that one included` : '');

/** What `--wait <minutes>` and `--no-wait` mean, for the usage of `check` and of `js-harness gate`, which
 * take the two flags alike. The bound is not on the whole of a wait (`takeGateLock`). */
export const GATE_WAIT_USAGE =
  `       --wait <minutes>: how long the machine's gate lock may go without changing hands before this gate gives up on it (${GATE_WAIT_MS / 60_000} when not given); --no-wait: refuse at once instead of waiting`;

/** The sentence of a refusal of the lock (`takeGateLock`), for a gate that was given `waitMinutes`: which
 * gate it was refused for, and whether that gate held the lock or waited ahead of this one for it. A wait
 * that ran out says how long the lock had not changed hands, which is what the bound is set on, and how
 * long the whole wait was where the two differ: behind a line that moved, a gate may have waited far
 * longer than its bound. */
function refusalSaid({ refused, holder, line, waitedMs, stillMs, besideOlder }, waitMinutes) {
  if (refused === 'held') return `${gateOf(holder)} holds the machine's gate lock, and --no-wait was given`;
  // Its launcher ended (./lib/launcher.mjs, odd/tasks/orphan-gate.md): nobody waits for what it would run.
  if (refused === 'launcher gone') return 'the process that started this gate ended while it waited, so it gave up its place in the line';
  if (refused === 'ahead') {
    return `${waitingGateOf(line?.head)} waits ahead of this one for the machine's gate lock, which no gate holds, and --no-wait was given; a gate that died as it waited is passed a minute after its last sign of life`;
  }
  const inAll = `this gate had waited ${duration(waitedMs)} in all`;
  // Beside a gate of an older version no line is kept, and the bound was not counted from the last change of
  // hands alone: it counts from the arrival, or from a change of hands read while the line was kept. So the
  // words "without the lock changing hands" would be untrue here (found in review, 2026-10-11).
  if (refused === 'timeout' && besideOlder) {
    const who = holder ? `${gateOf(holder)} holds the machine's gate lock now` : `${waitingGateOf(line?.head)} waits ahead of this one for the machine's gate lock, which no gate holds`;
    return `${who}; ${inAll}, and a gate of an older version of js-harness waited beside it, which keeps no line, so the bound counted from its arrival or from the last change of hands read while the line was kept (--wait gives up after ${minutes(waitMinutes)})`;
  }
  const bound = `(--wait gives up after ${minutes(waitMinutes)} without the lock changing hands)`;
  // A lock that did not tell is one that never changed hands while this gate waited, as far as is known.
  const still = Number.isFinite(stillMs) ? stillMs : waitedMs;
  if (!holder) {
    return `${waitingGateOf(line?.head)} waited ahead of this one and did not take the machine's gate lock, which no gate held: the lock had not changed hands for ${duration(still)}, and ${inAll} ${bound}`;
  }
  if (still < waitedMs) return `${gateOf(holder)} still held the machine's gate lock ${duration(still)} after it took it, and ${inAll} ${bound}`;
  return `${gateOf(holder)} still held the machine's gate lock after ${duration(waitedMs)} ${bound}`;
}

// A lock taken at once took a few milliseconds, and the report of a gate that waited for nobody says
// nothing of the lock. A wait this long is said: it is a poll for another gate, or a takeover.
// `js-harness gate` reads it too, for the same question: whether another gate ran until a moment ago.
export const GATE_WAIT_SAID_MS = 1000;

/** One turn at the machine's gate lock (`./lib/gate-lock.mjs`), taken the way a gate takes it, for
 * whoever runs under it: `check` around its sensors, `js-harness gate` around a command. `name` is who
 * says the wait, `command` what the holder's file says it runs, in the folder `cwd`.
 *
 * Whoever finds the lock held waits for it, and says on stderr, as the wait begins and for each gate it
 * then waits for, whose gate that is and for how long at most from then on: the caller is a commit running
 * in the background, and a silent wait reads as a hang. That is what is left of the bound, which is how
 * long the lock may go without changing hands (`waitMinutes`, as `--wait` takes it), so with each new
 * holder it is the whole bound again. A first version said the whole bound in every line when the bound
 * counted from the arrival, with most of it spent by the second line (found in review, 2026-10-10); it is
 * what is true since the bound counts from the last change of hands (2026-10-11).
 *
 * The lock is a line, and what is said of a gate is true of that gate. A gate that holds the lock is
 * "waited for to finish". One that only waits ahead of this one, with the lock free, is "stood behind"
 * and said to wait for its turn: it holds nothing, and is never named in a holder's words. A line says
 * how many gates are ahead of this one when the gate it names is not the only one.
 *
 * Resolves to `{ lock }` once the lock is held (`takeGateLock`), for the caller to release. Resolves to
 * `{ refused, reason }` when nothing may run: `wait` is off and the lock is held (`reason` is `held`) or a
 * gate waits ahead of this one for a lock nobody holds (`ahead`), or the lock went `waitMinutes` without
 * changing hands (`timeout`); `refused` is the sentence that says which, names the gate, and says whether
 * it holds the lock or waits for it (`refusalSaid`). Resolves to
 * `{ without }` when the lock cannot be taken at all (the home cannot be written, or a lock is there of
 * which nothing could be read for a minute, which is no gate to wait an hour for): `without` names the
 * lock and why, and the caller runs without it and says so, since the lock guards the machine's time
 * and not what is run.
 *
 * Every outcome also says whom this gate waited for and for how long, which is what the gate log keeps
 * (`./lib/gate-log.mjs`): `waitedMs`, and `waitedFor`, the gates the lock told of while it waited, as
 * `[{ cwd, pid, command }]`. They are the gates that held the lock, and no gate that only waited ahead of
 * this one: such a gate is there from the moment it holds the lock, if this gate still waits then. Each is
 * there once, by the token of its holder's file, since the lock tells of a gate again when its beat stops
 * being readable, and with all that any telling of it read: a file that was busy at first names its gate
 * once it reads. A holder that gave no token (a lock folder that could not be listed gives none) cannot be
 * met again by its name, so it is there once for each thing that was read of it: a gate of which nothing
 * is known is there once, with nothing said of it, and what was read of one such holder is never said of
 * another. A first version kept one entry for every holder without a token, and added to it what each of
 * them said (found in review, 2026-10-11). The gate a refusal names is among them when it held the lock:
 * told not to wait, a gate is told of nobody. The lock says how long a wait was that ended in a lock or a
 * refusal; one that ended in no lock at all is timed here.
 *
 * `session` is the id of the host's session that started the gate, or `null` where the host gives none:
 * the lock writes it in the gate's file, where the session board reads it. `check` and `js-harness gate`
 * pass what their environment says (`CLAUDE_CODE_SESSION_ID`). `first` is the ticket this gate claimed
 * (`{ id, reason }`, ./lib/gate-first.mjs), handed to the lock, which puts the gate before every gate that
 * waits; a gate waited for that went first by a ticket is marked `first: true` among `waitedFor`.
 * `take` stands in for `takeGateLock`, so a test stands in for the lock or runs the real one on its own
 * clock. */
export async function takeGateTurn({ name, home, cwd, command, wait, waitMinutes, session = null, stillWanted, first = null }, take = takeGateLock) {
  const waitMs = waitMinutes * 60_000;
  const met = new Map();
  // One entry for each token, to which a later telling adds what the entry does not have yet: a holder's
  // file that is busy at the first look is told of by its token alone, and with its folder and command once
  // it reads. What is known is never taken back by a look that read less. A holder with no token is known
  // by what was read of it, so nothing is ever added to its entry.
  const meet = (holder) => {
    const said = { cwd: holder.cwd ?? null, pid: holder.pid ?? null, command: holder.command ?? null };
    const key = holder.token != null ? `token ${holder.token}` : `no token ${JSON.stringify([said.pid, said.cwd, said.command])}`;
    const known = met.get(key) ?? { cwd: null, pid: null, command: null };
    const first = known.first || typeof holder.first === 'string';
    met.set(key, { cwd: known.cwd ?? said.cwd, pid: known.pid ?? said.pid, command: known.command ?? said.command, ...(first && { first: true }) });
  };
  const waitedFor = () => [...met.values()];
  const onWait = (holder, leftMs = waitMs, line) => {
    // What is left of the bound when this gate is first waited for: the whole of it, as `--wait` takes
    // it, while under a second is spent, which is the first line of a wait and the line of each new holder.
    const left = waitMs - leftMs < GATE_WAIT_SAID_MS ? minutes(waitMinutes) : duration(leftMs);
    if (!holder) {
      // Nobody holds the lock, and the gate ahead is to take it: a gate that waits, which is not met as a
      // gate this one waited for until it holds the lock.
      console.error(`${name}: waiting behind ${waitingGateOf(line?.head)}, which waits for its turn at the machine's gate lock, for ${left} at most${aheadSaid(line)}`);
      return;
    }
    meet(holder);
    // A holder that already reads stale is waited for a poll or two, not for the whole bound.
    const silent = holder.stale ? '; it has been silent for over a minute, and its lock is taken over if it stays so' : '';
    console.error(`${name}: waiting for ${gateOf(holder)} to finish, for ${left} at most${silent}${aheadSaid(line)}`);
  };
  let lock;
  const askedAt = Date.now();
  try {
    // `stillWanted`, from `js-harness gate` alone: whether its launcher lives (`takeGateLock`).
    lock = await take({ home, cwd: path.resolve(cwd), command, session, wait, waitMs, onWait, ...(stillWanted ? { stillWanted } : {}), ...(first ? { first } : {}) });
  } catch (err) {
    return { without: `the machine's gate lock, which could not be taken (${err instanceof Error ? err.message : String(err)})`, waitedMs: Date.now() - askedAt, waitedFor: waitedFor() };
  }
  if (!lock.refused) return { lock, waitedMs: lock.waitedMs, waitedFor: waitedFor() };
  if (lock.holder) meet(lock.holder);
  return { refused: refusalSaid(lock, waitMinutes), reason: lock.refused, waitedMs: lock.waitedMs, waitedFor: waitedFor() };
}

/** Runs `run`, the sensors of the gate that checks `cwd`, while this gate holds the machine's gate lock
 * (two gates at once make both miss their time bound with every test green), and resolves to their
 * rows, with a row named `gate` for whatever the lock did that a reader must know. Taken at once, which
 * is the common case, it adds none.
 *
 * The lock is taken as `takeGateTurn` says, in the turn of this gate in the line, for the session
 * `session` (`null` where the host names none). The time a gate waited for it is an INFO row. It counts
 * against no sensor's timeout, which starts when the sensor does. With `wait` off and the lock held or a
 * gate ahead in the line, or once the lock went `waitMinutes` without changing hands, the row is a FAIL
 * that names that gate, as the holder or as a gate that waits, and `run` is not called: a gate that ran
 * nothing must not look green.
 *
 * A lock that cannot be taken at all does not turn a gate red, since the lock guards the machine's time
 * and not the project's code: `run` is called without it and an INFO row says so and why. So does a
 * lock lost while the sensors ran, which happens only to a gate that was silent for the whole stale
 * time (a machine that slept).
 *
 * The lock is released on every way out of `run`, a throw included. A gate that is killed (a Ctrl-C, a
 * closed terminal) leaves its holder's file, which beats no more: the next gate reads it stale a minute
 * after its last beat and takes it over, having said whose gate it waits for. No signal is handled here
 * to release it sooner: a handler would have to end the process itself, and `check` would no longer end
 * on a Ctrl-C the way it does today.
 *
 * `run({ lock: 'own', waitedMs, waitedFor })` is called with the lock in hand, and the sensors are then
 * given the mark of a held lock (`GATE_HELD_ENV`); `run({ lock: 'none', ... })` is called without the
 * lock. Both are told whom this gate waited for and for how long, as `takeGateTurn` says it, which the
 * gate writes in its log. A gate that is refused writes one line there through `record`, where it has
 * one (`gateRecord` of `./lib/gate-log.mjs`), and a line that could not be written is one more row.
 * `takeGateLock` is injectable, as in `takeGateTurn`. */
async function underGateLock(cwd, { home, wait, waitMinutes, session, first = null }, { takeGateLock: take = takeGateLock }, run, record) {
  const turn = await takeGateTurn({ name: 'check', home, cwd, command: 'check', wait, waitMinutes, session, first: first && { id: first.id, reason: first.reason } }, take);
  const { waitedMs, waitedFor } = turn;
  if (turn.without) {
    return [gateRow(`the sensors ran without ${turn.without}, so another gate may have run at the same time`), ...(await run({ lock: 'none', waitedMs, waitedFor }))];
  }
  if (turn.refused) {
    record?.refused({ reason: turn.reason, waitedMs, waitedFor });
    return [gateRow(`no sensor ran: ${turn.refused}`, false), ...gateLogRows(record)];
  }
  const { lock } = turn;
  const waited = lock.waitedMs >= GATE_WAIT_SAID_MS;
  const rows = waited ? [gateRow(`waited ${duration(lock.waitedMs)} for the machine's gate lock before the sensors ran`)] : [];
  if (first) rows.push(gateRow(`this gate claimed ticket ${first.id} (${first.reason}), issued by ${first.by ?? 'a session the ticket does not name'}, and went before every gate that waited`));
  let lost = false;
  try {
    rows.push(...(await run({ lock: 'own', waitedMs, waitedFor })));
  } finally {
    // Asked before the release, after which a gate has no lock to have lost.
    lost = lock.lost();
    lock.release();
  }
  if (lost) rows.push(gateRow("the machine's gate lock was lost while the sensors ran: this gate was silent for over a minute and another took its lock, so two gates may have run at once"));
  return rows;
}

/** `check --first <reason>`: issues the session of `lock` a ticket for the tree `cwd`, issued by that session
 * itself, which the gate then claims as it arrives (`claimOf`), and writes the issue in the gate log as `gate
 * first` does. Returns the rows to add: none when it was issued, and an INFO row that says why when it was not
 * (no session, two tickets open already, or a gate in the turn of the process that holds the lock, which waits
 * for nobody); the gate runs all the same. The board flags a ticket whose issuer is not the orchestrator. */
function ownTicketRows(reason, cwd, lock, env, deps) {
  const notIssued = (why) => ({ rows: [{ name: 'first', pass: true, info: true, detail: `no ticket was issued: ${why}` }], issued: null });
  if (lock.held) return notIssued('this gate runs in the turn of the process that holds the gate lock, and waits for nobody');
  if (lock.session === null) return notIssued('the host names no session for this gate, and a ticket is for a session');
  // An open ticket of this session that this gate would claim is the one it goes first by: no second (Codex).
  const tree = path.resolve(cwd);
  const mine = readTickets(lock.home).open.find((ticket) => ticket.session === lock.session && (!ticket.tree || ofTree(ticket.tree, tree, process.platform)));
  if (mine) return notIssued(`ticket ${mine.id} of this session is open already for this tree, and this gate claims it`);
  let issued;
  try {
    issued = issueTicket({ home: lock.home, session: lock.session, tree: path.resolve(cwd), reason, by: lock.session });
  } catch (err) {
    if (!(err instanceof GateFirstError)) throw err;
    return notIssued(err.message);
  }
  if (!gateLogSwitchedOff(env)) {
    const written = { ...(deps.gateLog?.append && { append: deps.gateLog.append }) };
    for (const gone of issued.expired) logTicket(lock.home, 'first-expired', gone, {}, written);
    logTicket(lock.home, 'first-issued', issued.ticket, {}, written);
  }
  return { rows: [], issued: issued.ticket.id };
}

/** Claims the ticket of the session of `lock` for the gate that checks `cwd` (`claimTicket`), and writes in
 * the gate log what the claim did: the tickets its sweep found expired, those it left because their file was
 * held, and the claim, with the gates that
 * waited then, which this one passes. Nothing is written with the log switched off (`lock.log` false).
 * Returns the ticket, or `null`. `deps.gateLog` stands in for the writer, as for the gate's own lines, and
 * `deps.claimTicket` for the claim. The code of a hold goes in `error`: the log's `code` is the key of a tree. */
export function claimOf(lock, cwd, deps, { named = false } = {}) {
  const claim = deps.claimTicket ?? claimTicket;
  const { ticket, expired, unclaimed = [] } = claim({ home: lock.home, session: lock.session, cwd: path.resolve(cwd), named });
  if (lock.log === false) return ticket;
  const written = { ...(deps.gateLog?.append && { append: deps.gateLog.append }) };
  for (const gone of expired) logTicket(lock.home, 'first-expired', gone, {}, written);
  for (const { ticket: held, code } of unclaimed) logTicket(lock.home, 'first-unclaimed', held, { error: code, cwd: path.resolve(cwd), pid: process.pid }, written);
  if (ticket) {
    let waiting = [];
    try {
      waiting = readGateWaiters(lock.home).filter((gate) => typeof gate.first !== 'string');
    } catch {
      // a line that cannot be read passes nobody that can be named
    }
    logTicket(lock.home, 'first-claimed', ticket, { cwd: path.resolve(cwd), pid: process.pid, passed: waiting.map(({ cwd: folder, pid }) => ({ cwd: folder, pid })) }, written);
  }
  return ticket;
}

/** A row named `gate`: what the machine's gate lock did that a reader of the report must know. It informs
 * and fails nothing, but for a gate that ran no sensor (`pass` false). */
const gateRow = (detail, pass = true) => ({ name: 'gate', pass, ...(pass && { info: true }), detail });

/** The one row of a gate that stopped before its sensors because `rows`, the rows it knew before them,
 * had already failed (`checkSensors`). A FAIL named `gate`, as for a gate that was refused its turn, and
 * for the same reason: a report that ends without a `tests` row must not read as one whose tests passed. So
 * it says that no sensor ran, which rows stopped the gate, and what became of the machine's gate lock: not
 * taken, or, with `held`, left to the process that started this gate. `stopped` is for the caller, which
 * prints no row after this one. */
function stoppedRow(rows, held) {
  const failed = rows.length === 1 ? `the row ${rows[0]} fails` : `the rows ${rows.join(', ')} fail`;
  const lock = held
    ? `the machine's gate lock was left to the process that started this gate, which holds it (${GATE_HELD_ENV}=1)`
    : "the machine's gate lock was not taken";
  return { ...gateRow(`no sensor ran: this gate stopped before its sensors, since ${failed}, so no test ran and nothing here says that the tests pass; ${lock}`, false), stopped: true };
}

/** The row named `gate log` of a gate whose record could not be written, saying why and what is missing
 * from the log; no row for a gate that wrote its lines, or that has no record. It informs: nothing a gate
 * proves is in its log. */
function gateLogRows(record) {
  const failure = record?.failure();
  return failure ? [{ name: 'gate log', pass: true, info: true, detail: failure }] : [];
}

/** What the sensors of a gate came to, for its log: `timeout` when the time of one ran out, which is what
 * explains a slow gate, else `pass` or `fail`. */
const sensorsResult = (rows) => (rows.some((row) => row.timedOut) ? 'timeout' : rows.every((row) => row.pass) ? 'pass' : 'fail');

/** The watch of who spends the processor over a gate's run (`watchBusiest` of `./lib/machine-busiest.mjs`,
 * and odd/tasks/gate-wait.md, T19), started where the gate's start is in its log, and only there: what it
 * finds is kept under that start's id (`busiest` of `gateRecord`), and a start that is not in the log has
 * nothing to key it by. Returns `null` there, or the step that ends the watch and keeps what it found, for
 * after the run: it resolves once the end reading is in, and never rejects. `check` and `js-harness gate`
 * call it as their command or first sensor is about to start, and its first reading is not waited for: it
 * costs a gate no second before its run, and seconds after it.
 *
 * Best effort throughout, as the look before a gate is: a watch that cannot start, an end that fails or
 * finds nobody keeps nothing and says nothing, and the gate is what it would have been. `watch` stands in
 * for `watchBusiest` in a test. */
export function watchRun(record, watch = watchBusiest) {
  if (!record?.started?.()) return null;
  let watching;
  try {
    watching = watch();
  } catch {
    return null;
  }
  return async () => {
    try {
      const ended = await watching?.end();
      record.busiest({ seconds: ended?.seconds, busiest: ended?.busiest });
    } catch {
      // nobody found: nothing to keep
    }
  };
}

/** One row per sensor, run one after another; a broken declaration, of the sensors or of the documents,
 * is one FAIL row and no sensor at all is one INFO row.
 *
 * A commit that holds documents alone runs no sensor: where the project declares its documents
 * (`discoverDocuments`) and every staged path is one of them (`stagedDocuments`), the one row is an INFO
 * that says which sensors did not run and for which paths, and no lock is taken, there being nothing to
 * run under it. `deps.git` stands in for the `spawnSync` that asks git what is staged.
 *
 * Where the project also declares sensors of documents (`discoverDocumentSensors`), that commit runs
 * those, one row each after the INFO row, and still takes no lock and leaves no record: they are checks
 * of seconds (`documentSensorRows`), and they run even in a gate that a static row already failed.
 *
 * With `lock` (`{ home, wait, waitMinutes, session }`, which is what a gate passes) the sensors
 * run under the machine's gate lock in that home, and only when there is a sensor to run: see
 * `underGateLock`, which may add a row named `gate`. With `{ held: true }` for `lock`, which is what a
 * gate passes when it was started with the mark of a held lock (`GATE_HELD_ENV`), no lock is taken: the
 * sensors run at once in the turn of the process that started this gate, are given the mark as well,
 * and a row named `gate` says so. Without `lock` they run as they are, which is for a caller that is no
 * gate.
 *
 * A gate, which is a call with `lock` in any of its three states (its own lock, the turn of the process
 * that started it, no lock because none could be taken), reads the machine's load once before its first
 * sensor and says it in an INFO row named `load` (`./lib/machine-load.mjs`): a gate's time depends on
 * what else the machine runs, and a slow gate is then explained by its own report. A second, of a run of
 * minutes. A gate that waited for another says so in that row, since what it reads is the tail of that
 * gate. The row decides nothing, and a load that could not be read is said in it. On a loaded machine,
 * from one busy logical processor on, the gate also looks for what loads it, for some seconds more, and
 * the row names the three busiest processes at most in lines of its own
 * (`./lib/machine-busiest.mjs`); a look that finds nobody or fails leaves the row with its figure alone.
 * No sample is taken, nothing looked for and no row printed where no sensor runs, for a caller that is no
 * gate, or with `load: false` in `lock`, which is how a gate passes on the switch of its environment
 * (`GATE_LOAD_ENV`).
 * `deps.sampleLoad` stands in for the sampler, and `deps.busiest` for the look.
 *
 * A gate also leaves a record of itself in the gate log of its home (`./lib/gate-log.mjs`), which is why
 * `lock` names the home in each of its states: a line when its sensors are about to run, after the sample,
 * that says the state of the lock, whom it waited for and the load it read, and a line when they are done,
 * on every way out of them, a throw included, with what each sensor came to. A gate that was refused its
 * turn writes one line. A line that could not be written is said once in an INFO row named `gate log`,
 * and changes nothing else. Nothing is written where no sensor runs, for a caller that is no gate, or with
 * `log: false` in `lock`, which is how a gate passes on the switch of its environment (`GATE_LOG_ENV`).
 * `deps.gateLog` stands in for what the record is written with: `{ append, now, id }`, each optional.
 *
 * A gate whose start is in the log also keeps who spent the processor over its run, beside the log in
 * `busiest.jsonl` (`watchRun`): every process's processor time is read as its first sensor starts, without
 * being waited for, and again after the last, and the heaviest that lived through the run are written
 * under the id of its start. Nothing is said of it in the report, and nothing is read with `load: false`
 * in `lock`: the switch of the sample is the switch of every reading of the machine. `deps.watchBusiest`
 * stands in for the watch.
 *
 * A gate stops before its sensors when a row it knew before them has already failed, which it says with
 * `stoppedBy` in `lock`, the names of those rows: the commit cannot pass, so the wait for the lock, an hour
 * at most, and the run of the sensors would be paid before anyone read a failure that was known in a
 * second. Nothing after the stop happens: no lock is asked for or waited for and no folder made for one,
 * no load is sampled, no sensor runs. The one row (`stoppedRow`) is a FAIL named `gate` that says so and
 * names the rows, and carries `stopped: true` for the caller, which prints no row after it. With
 * `{ held: true }` the lock stays with the process that started this gate, which waited its turn before
 * this one computed anything: there the stop saves the sensors, not the wait.
 * It is decided here and not by the caller, after both declarations are read and after the two ways out
 * above it: a faulty declaration is named in the same run as the row that failed, and a gate that would
 * have run no sensor (none declared, a commit of documents alone) ends as it always did, with nothing to
 * stop. The gate log has one line of a kind of its own for a gate that stopped, with the rows, and no
 * start, which would read as a gate that was killed; the same switches silence it.
 *
 * A gate that runs its sensors also asks git for the untracked paths of its working tree, before the first
 * sensor and after the last, and names in an INFO row named `tree` the ones that appeared meanwhile
 * (`treeRows`). It fails nothing, and there is no row when none appeared or git did not say. Asked through
 * `deps.git`, outside the two lines of the gate's record so that the seconds of the log stay the sensors',
 * and not at all where no sensor runs or for a caller that is no gate.
 *
 * `lock.wsl` is what the machine's switch file of WSL2 says (`readGateWsl` of `./lib/gate-wsl.mjs`), and it
 * counts only for a project that lets it (`discoverSensorsInWsl`): with a distribution, the sensors of the
 * turn run there (`checkSensor`), where they ran is part of the tree's key, and what they left in the
 * mirror is named in a `tree` row (`mirrorRows`); with an error, the gate fails in one row named `wsl`
 * before any sensor runs. The sensors of documents never move: they are checks of seconds. */
export async function checkSensors(cwd, deps = {}, lock) {
  const { sensors, source, error } = discoverSensors(cwd);
  if (error) return [{ name: 'sensors', pass: false, detail: error }];
  // Read before anything runs or is skipped: a declaration that cannot be taken fails the gate even
  // where there is no sensor for it to skip.
  const declared = discoverDocuments(cwd);
  if (declared.error) return [{ name: 'sensors', pass: false, detail: declared.error }];
  const sameTree = discoverSameTree(cwd);
  if (sameTree.error) return [{ name: 'sensors', pass: false, detail: sameTree.error }];
  const inWsl = discoverSensorsInWsl(cwd);
  if (inWsl.error) return [{ name: 'sensors', pass: false, detail: inWsl.error }];
  const exact = discoverExactTests(cwd);
  if (exact.error) return [{ name: 'sensors', pass: false, detail: exact.error }];
  const concurrency = discoverTestConcurrency();
  if (concurrency.error) return [{ name: 'sensors', pass: false, detail: concurrency.error }];
  const quick = discoverDocumentSensors(cwd, declared.documents);
  if (quick.error) return [{ name: 'sensors', pass: false, detail: quick.error }];
  // Git is asked only by a project that declares documents, and has a sensor their commit would not run
  // or one it would: without them nothing here changed.
  const staged = declared.documents.length > 0 && sensors.length + quick.sensors.length > 0
    ? stagedDocuments(cwd, declared.documents, deps.git)
    : null;
  // Before the stop below, and with no record: the sensors of documents wait for no turn and are no
  // suite, so there is nothing for a stop to save, and a failure of theirs is read in the same run.
  if (staged) return [documentsRow(sensors, staged, quick.sensors), ...(await documentSensorRows(cwd, quick.sensors, deps, lock?.held === true))];
  if (sensors.length === 0) {
    const detail = source === 'harness.json'
      ? 'harness.json declares no sensors, so none ran'
      : 'no sensors declared: add test, lint or typecheck scripts to package.json, or a "sensors" object to harness.json';
    return [{ name: 'sensors', pass: true, info: true, detail }];
  }
  // A switch file of WSL2 that cannot be taken fails the gate as a broken declaration does: a gate that
  // ran its suite where nobody asked would say nothing of the file that was meant to move it.
  // The machine says how (its switch file), the project whether (`sensorsInWsl`): a project whose suite
  // cannot run on Linux is never moved by a file another project's machine holds.
  const wsl = inWsl.value ? lock?.wsl ?? null : null;
  if (wsl?.error) return [{ name: 'wsl', pass: false, detail: wsl.error }];
  // Where the sensors run is part of the key of the tree: a pass in WSL2 proves nothing for a run on
  // Windows, which is there to catch what WSL2 cannot.
  const place = wsl?.distro && (deps.platform ?? process.platform) === 'win32' ? `wsl ${wsl.distro} ${wsl.node}` : undefined;
  const record = lock && lock.log !== false && lock.home !== undefined
    ? gateRecord({ home: lock.home, cwd: path.resolve(cwd), command: 'check', session: lock.session, ...deps.gateLog })
    : null;
  // The ticket of this gate's session, claimed as it arrives and so spent whatever comes next: a gate that
  // stops, is proven by its tree or is refused spends it too, and its tree cannot jump the line twice
  // (./lib/gate-first.mjs). Not by a gate in the turn of the process that started it, which waits for nobody.
  // The ticket rides on `lock` to the turn (`underGateLock`), `first` being `null` where none was claimed.
  if (lock && lock.held !== true && lock.home !== undefined) lock = { ...lock, first: claimOf(lock, cwd, deps) };
  // The stop, here and not sooner: both declarations are read and this gate would now run its sensors.
  if (lock?.stoppedBy?.length) {
    record?.stopped({ rows: lock.stoppedBy });
    return [stoppedRow(lock.stoppedBy, lock.held === true), ...gateLogRows(record)];
  }
  // The key of the tree this gate guards (`treeKey`), where the project declares that a tree is not run
  // twice and this gate keeps a record: the proof is a line of the gate log, so a gate that neither reads
  // nor writes that log has no key. `null` in every doubt, which is a gate that runs its sensors.
  const keyNow = () => (sameTree.skip && record ? treeKey(hookGit(cwd, deps.git), { sensors, place }) : null);
  // The rows of a gate that runs no sensor because the gate log holds the proof of `key`, after its own
  // line is written; `null` when there is no key or no proof.
  const proven = (key) => {
    const proof = key === null ? null : provenBy(readGateLog(lock.home).events, key);
    if (proof === null) return null;
    record.same({ code: key, by: proof.id });
    return [sameTreeRow(sensors, proof), ...gateLogRows(record)];
  };
  // Asked here, before the lock: a gate with its proof waits for nobody.
  let key = keyNow();
  const already = proven(key);
  if (already) return already;
  // `turn` is how a gate came to its sensors: the state of the lock, and whom it waited for. A caller that
  // is no gate has none.
  const run = async (turn) => {
    // A gate that waited asks again: the folder may have changed in the wait, and the gate it waited for
    // may have been of this very tree.
    if (turn?.waitedMs > 0) {
      key = keyNow();
      const meanwhile = proven(key);
      if (meanwhile) return meanwhile;
    }
    const rows = [];
    // With the lock in hand, its own or the one of the process that started it.
    const gateHeld = turn !== undefined && turn.lock !== 'none';
    // Here and nowhere else: every gate comes to its sensors through this, whatever the lock did, and with
    // the lock in hand where there is one, so the second of the sample is not another gate's.
    let load;
    if (lock && lock.load !== false) {
      load = await readLoad(deps.sampleLoad, deps.busiest);
      const lines = loadLines(load);
      // A wait long enough to be said is a gate that ran until a moment ago, whose tail the figure is.
      const afterGate = turn.lock === 'own' && turn.waitedMs >= GATE_WAIT_SAID_MS;
      rows.push({ name: 'load', pass: true, info: true, detail: loadDetail(load, { afterGate }), ...(lines.length ? { lines } : {}) });
    }
    // What is untracked in the working tree before the sensors, for a gate alone. Asked before the start is
    // written and again after the end, so neither look is in the seconds the log says the sensors took.
    const before = lock ? untrackedPaths(cwd, deps.git) : null;
    record?.start({ ...turn, load });
    // Who spends the processor over the run, from its first reading on, which is not waited for here; with
    // the sample of the load switched off, nothing is read of the machine (`GATE_LOAD_ENV`).
    const keepBusiest = lock && lock.load !== false ? watchRun(record, deps.watchBusiest) : null;
    const ran = [];
    let result = 'error';
    // The key this gate proves: the one it had before its sensors, when all of them passed and the tree
    // has that key still. A file that changed while they ran is a suite of no one tree, and proves none.
    // Asked before the end is written, which holds it, so its two git processes are in the seconds the
    // log says the sensors took: a fraction of one.
    let code;
    try {
      for (const sensor of sensors) {
        // The tests sensor in shadow or skip mode, where the project says so and its suite is `node --test`
        // alone; a suite of another command runs as it did, and its row says why it has no exact tests.
        const tests = exact.value !== null && sensor.name === 'tests' ? testsCommand(cwd, sensor.command) : null;
        const dir = tests === 'node --test' ? tracesDir(cwd, deps.git) : null;
        // The tests sensor that many files at a time where the variable says so, when it is `node --test`;
        // `checkSensor` adds the flag, with the files of a skip gate after it (`testsCommandLine`).
        const concurrent = concurrency.value !== null && sensor.name === 'tests' ? testsCommand(cwd, sensor.command) : null;
        const row = await checkSensor(cwd, sensor, { ...deps, gateHeld, wsl, traces: dir ? { dir, mode: exact.value } : null, concurrency: concurrent === 'node --test' ? concurrency.value : null });
        if (tests !== null && tests !== 'node --test') row.detail += `; harness.json "exactTests" is "${exact.value}", but the tests run by \`${tests}\`, not \`node --test\`: ${exact.value === 'skip' ? 'no exact tests' : 'no shadow'}`;
        if (concurrent !== null && concurrent !== 'node --test') row.detail += `; ${TEST_CONCURRENCY_ENV} is ${concurrency.value}, but the tests run by \`${concurrent}\`, not \`node --test\`: they run as written`;
        // A red suite of `node --test` that names its failed test files runs them once more, alone and
        // untraced, by the same route (odd/tasks/flaky-ledger.md, Design 2). A timeout names nothing it
        // can trust, and a suite of another command has no files to give.
        if (sensor.name === 'tests' && !row.pass && !row.timedOut && testsCommand(cwd, sensor.command) === 'node --test') {
          const files = failedTestFiles(row.output, testFilesOf(cwd));
          if (files.length > 0) {
            const again = await checkSensor(cwd, { name: 'tests', command: `node --test ${files.join(' ')}` }, { ...deps, gateHeld, wsl, traces: null });
            row.rerun = { files, pass: again.pass, detail: again.detail };
            // Design 3: the row passes only when the rerun did and every file it ran has a current entry.
            const judged = judgeRerun(row.rerun, ledgerEntries(cwd), deps.today ?? localDay());
            row.rerun.row = judged.row;
            if (judged.pass) {
              row.pass = true;
              row.detail += `; its failed test ${files.length === 1 ? 'file' : 'files'} passed alone on rerun and ${files.length === 1 ? 'is' : 'are'} quarantined in docs/FLAKY.md (the rerun row)`;
            }
          }
        }
        ran.push(row);
      }
      result = sensorsResult(ran);
      // A sensor that came back to Windows ran where its key does not say: it proves no tree.
      const ranWhereKeyed = ran.every((row) => (place ? row.ranIn === 'wsl' : !row.ranIn));
      // Nor does a pass that rests on a quarantine: its entry expires, and a proof of the tree would not.
      const quarantined = ran.some((row) => row.rerun);
      // A passing gate in skip mode writes the key too (odd/tasks/exact-tests.md, T4c): the files it skipped are
      // proven by their stored passing traces, which is the premise of the switch S6's count earned.
      if (result === 'pass' && key !== null && ranWhereKeyed && !quarantined && keyNow() === key) code = key;
    } finally {
      // On every way out, a throw included: only a gate that was killed leaves a start alone in the log.
      // A sensor that failed keeps the names of its failing tests, where its output says them (`failingTests`).
      // A skip gate's tests row keeps `skip`, never `shadow`, so S6's count (`s6Count`) never reads it.
      const failing = ({ pass, output, rerun }) => (pass && !rerun ? [] : failingTests(output));
      record?.end({ result, sensors: ran.map((row) => ({ name: row.name, seconds: row.seconds, pass: row.pass, timedOut: row.timedOut, ...(row.ranIn && { ranIn: row.ranIn }), ...(failing(row).length > 0 && { failing: failing(row) }), ...(row.shadow && { shadow: shadowCounts(row.shadow) }), ...(row.skip && { skip: row.skip }) })), code });
      // Beside the log, under the gate's id: a list of every file on the end line would rotate the log far sooner.
      record?.testTimes(ran.flatMap((row) => row.times ?? []));
    }
    // Not asked again where git did not answer before the sensors: there is nothing to compare with.
    const after = before && untrackedPaths(cwd, deps.git);
    // After the end is written, so that the seconds of the log stay the sensors'.
    await keepBusiest?.();
    return [...rows, ...ran, ...ran.flatMap((row) => (row.rerun ? [row.rerun.row] : [])), ...treeRows(before, after), ...mirrorRows(ran), ...gateLogRows(record)];
  };
  if (!lock) return run();
  if (lock.held) {
    const inTurn = `the sensors ran in the turn of the process that started this gate, which holds the machine's gate lock (${GATE_HELD_ENV}=1), so this gate took none`;
    return [gateRow(inTurn), ...(await run({ lock: 'parent', waitedMs: 0, waitedFor: [] }))];
  }
  return (await testsOnCi(cwd, lock, deps, record)) ?? underGateLock(cwd, lock, deps, run, record);
}

/** The rows of a gate whose tests ran on GitHub's machines, where every commit's gate goes first
 * (./lib/ci-gate.mjs), or null for a gate that runs here: the project has no gate workflow, the switch keeps it
 * here, or CI gave no answer, which it says on stderr. Such a gate leaves its own record in the gate log, its
 * tests marked as run on CI and the names of those that failed there, so the measures of the lines count both. A
 * gate CI gave no answer leaves a `ci-fallback` line under `local`'s id, the record of the gate that then runs
 * here, with what the wait cost. `deps.ciGateWanted` and `deps.runCiGate` stand in for the two halves. */
async function testsOnCi(cwd, lock, deps, local = null) {
  const why = (deps.ciGateWanted ?? ciGateWanted)({ cwd, env: lock.env ?? process.env });
  if (!why) return null;
  console.error(`check: ${why}; the push of the tree being committed starts their run`);
  const startedAt = Date.now();
  const ci = await (deps.runCiGate ?? runCiGate)({ cwd, remote: lock.remote ?? 'origin', env: lock.env ?? process.env });
  if (!ci.ran) {
    console.error(`check: no answer from GitHub's machines (${ci.why}), so the tests run here`);
    local?.ciFallback({ seconds: Math.round((Date.now() - startedAt) / 1000), reason: ci.why });
    return null;
  }
  const tests = { name: 'tests', pass: ci.pass, detail: `ran on GitHub's machines in ${ci.seconds}s (${CI_WORKFLOW}): ${ci.url}`, ...(ci.output && { output: ci.output }) };
  let at = startedAt;
  const record = lock.log !== false && lock.home !== undefined
    ? gateRecord({ home: lock.home, cwd: path.resolve(cwd), command: 'check', session: lock.session, now: () => at, ...deps.gateLog })
    : null;
  record?.start({ lock: 'ci', waitedMs: 0, waitedFor: [] });
  at = Date.now();
  const failing = ci.pass ? [] : failingTests(ci.output);
  record?.end({ result: ci.pass ? 'pass' : 'fail', sensors: [{ name: 'tests', seconds: ci.seconds, pass: ci.pass, ranIn: 'ci', ...(failing.length > 0 && { failing }) }] });
  return [gateRow(`the tests ran on CI: ${why}`), tests, ...gateLogRows(record)];
}

/** One `gentle-ai <args>` run as `{ status, stdout, stderr, error? }`; a spawn that throws is an `error`. */
function runGentleAi(spawn, args, timeout) {
  try {
    return spawn('gentle-ai', args, { encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024 }) ?? { error: new Error('no result') };
  } catch (error) {
    return { error };
  }
}

/** Parses `text` as a JSON object, else `null`. */
function jsonObject(text) {
  try {
    const value = JSON.parse(text);
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

/** Why a gentle-ai run gave nothing usable, in a few words. */
function whyNoAssessment(result, timeout) {
  if (result.error?.code === 'ETIMEDOUT') return `timed out after ${Math.round(timeout / 1000)}s`;
  if (result.error) return result.error.message;
  const said = String(result.stderr ?? '').trim().split('\n')[0];
  const exit = result.status === null ? `killed by ${result.signal ?? 'a signal'}` : `exit ${result.status}`;
  return said ? `${exit}: ${said}` : `${exit}, no assessment on stdout`;
}

/** The `review` row: whether the pending change is due a gentle-ai review by risk, so the answer shows
 * at every commit instead of depending on anyone remembering to ask. Informational and fail-open: gentle-ai
 * owns review and RDD is the user's switch, so a missing, failing or slow gentle-ai never turns a commit red.
 * Only an explicit `off` skips the assessment; an unreadable mode counts as on, the switch's default. */
export function checkReview(cwd, { spawn = spawnSync, git = spawnSync, timeout = 20000 } = {}) {
  const row = (detail, lines) => ({ name: 'review', pass: true, info: true, detail, ...(lines?.length ? { lines } : {}) });
  // With the Codex review off here, gentle-ai's is the one review of the code: it is said due from medium risk up,
  // his rule (odd/tasks/on-demand-functions.md, S9), and its absence is said too.
  const codexOff = codexSwitchHere(cwd, git).value === 'off';
  const notFound = () => row('gentle-ai was not found, so review by risk was not assessed');
  const isMissing = (result) => result.error?.code === 'ENOENT';

  const mode = runGentleAi(spawn, ['review', 'mode', 'status', '--cwd', cwd, '--json'], timeout);
  if (isMissing(mode)) return notFound();
  const status = mode.error || mode.status !== 0 ? null : jsonObject(mode.stdout)?.status;
  if (isObject(status) && status.effective === 'off') {
    const off = `RDD is off (${status.source ?? 'unknown source'}), so no review was assessed`;
    return row(codexOff ? `${off}, and the Codex review is off here: no review reads this project's code` : off);
  }

  // Parsed whatever the exit code: on a clean tree gentle-ai exits non-zero and still prints the JSON.
  const result = runGentleAi(spawn, ['review', 'assess', '--cwd', cwd, '--json'], timeout);
  if (isMissing(result)) return notFound();
  const assessed = result.error ? null : jsonObject(result.stdout);
  if (assessed?.schema !== 'gentle-ai.review-assessment/v1') {
    const reason = assessed ? 'unexpected schema' : whyNoAssessment(result, timeout);
    return row(`gentle-ai review assess gave no assessment (${reason})`);
  }
  const { risk, changed_paths: paths, changed_lines: changed, review_due: due, review_due_reason: dueReason } = assessed;
  const wellFormed = typeof risk === 'string' && Number.isInteger(paths) && Number.isInteger(changed) &&
    typeof due === 'boolean' && typeof dueReason === 'string';
  if (!wellFormed) return row('gentle-ai review assess gave no assessment (unexpected shape)');
  const reasons = (Array.isArray(assessed.reasons) ? assessed.reasons : []).filter((reason) => isObject(reason) && typeof reason.code === 'string');
  const lines = reasons.map((reason) => `${reason.code} ${reason.path ?? reason.detail ?? ''}`.trim());
  if (paths === 0) {
    // gentle-ai answers high and due both for a clean tree and for a candidate it could not build;
    // only its explicit "no pending changes" reason is the clean tree, which is no finding.
    const clean = reasons.some((reason) => reason.code === 'unassessable' && /no pending changes/.test(String(reason.detail)));
    return clean ? row('no pending change to assess') : row('gentle-ai could not assess the pending change', lines);
  }

  const count = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;
  // His answer (S9) is high and medium: gentle-ai may call a high change not due (under its budget), and with
  // no Codex review it is due all the same.
  const dueHere = !due && codexOff && (risk === 'medium' || risk === 'high');
  const why = dueHere ? `${risk} risk and the Codex review is off here` : dueReason;
  const detail = `${risk} risk, ${count(paths, 'path')}, ${count(changed, 'line')}: review ${due || dueHere ? 'due' : 'not due'} (${why})`;
  const next = assessed.next_transition?.command;
  if (due && typeof next === 'string') lines.push(`next: ${next}`);
  return row(detail, lines);
}

/** The `functions` row (odd/tasks/on-demand-functions.md): a switch of `harness.json` "functions" that cannot be
 * read fails the gate, as `sameTree` does, since every switch is then read as on and nothing says so but this;
 * a clone that is not what its switches ask is said so, one line a difference, and passes, since a gate writes
 * nothing and `js-harness functions apply` does. No row where the switches are read and applied. */
export function checkFunctions(cwd) {
  // Whether the switches can be read does not depend on the files of the tree, so no git is asked: a static
  // row is all a gate knows before its sensors, and one that fails stops the gate before any git. A
  // harness.json that is no JSON at all is the `sensors` row's to say, which reads the same file: one fault,
  // one row. This one says what is wrong in "functions".
  const harness = harnessOfTree(cwd);
  if (harness.error) return [];
  const { errors } = functionsOf(harness, { paths: [] });
  if (errors.length === 0) return [];
  return [{ name: 'functions', pass: false, detail: errors.join('; '), lines: ['until it is fixed every switch is read as on; js-harness functions shows each'] }];
}

/** The `functions` information row: one line for each way this clone is not what its switches ask, or no row.
 * Read-only, since a gate writes nothing, and asked only of a gate that was not stopped, as the `review` row is.
 * A clone the harness never set up holds no manifest to drift from and is told nothing (`clonePending`). */
export function checkFunctionsPending(cwd, { spawn = spawnSync } = {}) {
  const pending = clonePending(cwd, { spawn });
  if (pending.length === 0) return [];
  return [{ name: 'functions', pass: true, info: true, detail: 'this clone is not what its switches ask: js-harness functions apply makes it so', lines: pending }];
}

/** What the Codex review records say of the code commits between the default branch of `remote` and
 * `head`, for the two rows that read it: the `--push` row, which fails on a commit no record covers, and
 * the row of the plain check, which says how large the review of those commits is.
 *
 * `{ unknown }` when it cannot be told: the `detail` and `lines` of the `--push` row and, where those words
 * speak of a push, the `why` of the plain one. Otherwise the commit `tip` that `head` names, the default
 * branch as the ref `baseRef` and its label `base`, and what the records say of `base..tip`, as
 * `reviewCoverage` gives it: the `codeCommits` (newest first), the `covers`, the `uncovered` code commits,
 * with the `note` that counts the records that were left out.
 *
 * Which commits are code and which records cover them is not decided here. It is the one definition this
 * check shares with `js-harness codex-review` (`./lib/codex-review-coverage.mjs`), which reads it for the
 * range it is asked to review: what this refuses to push is what that command reviews. */
function codexReviewCoverage(cwd, head, { spawn, remote }) {
  const unknown = (detail, lines, why) => ({ unknown: { detail, ...(lines ? { lines } : {}), ...(why ? { why } : {}) } });
  const tip = gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${head}^{commit}`]);
  if (!tip) {
    return gitOut(spawn, cwd, ['rev-parse', '--git-dir']) === null
      ? unknown(`${cwd} is not a git repository`, undefined, 'this is not a git repository')
      : unknown(`cannot resolve --head ${head} to a commit`, undefined, `${head} does not name a commit`);
  }
  // Git hands a hook the URL, not a name, when the push names a URL: no ref of it can exist.
  const remotes = gitOut(spawn, cwd, ['remote'])?.split('\n').map((line) => line.trim()) ?? [];
  if (!remotes.includes(remote)) {
    return unknown(`${remote} is not a configured remote, so there is no default branch to compare against`, [
      'push through a configured remote: git remote add <name> <url>, then git push <name> ...',
      'or name one that exists: js-harness check --push --remote <name>',
    ]);
  }
  const branch = defaultBranch(spawn, cwd, remote);
  if (!branch) {
    return unknown(
      `no default branch of ${remote} to compare against (refs/remotes/${remote}/HEAD, ${remote}/main or ${remote}/master), so there is no range to check`,
      [`set it with: git remote set-head ${remote} --auto`],
    );
  }
  const { ref: baseRef, label: base } = branch;

  const coverage = reviewCoverage(cwd, { from: baseRef, tip, spawn });
  if (coverage.unknown === MARKS_UNREAD) {
    return unknown(`cannot read which files of ${base}..${head} a Codex review leaves out (\`git check-attr --source\` failed; it needs git 2.40 or later)`);
  }
  if (coverage.unknown) return unknown(`cannot list the commits in ${base}..${head}`);
  const { codeCommits, covers, uncovered, invalid, ignored } = coverage;
  const noteParts = [
    invalid ? `${invalid} invalid record${invalid === 1 ? '' : 's'} ignored` : '',
    ignored ? `${ignored} record${ignored === 1 ? '' : 's'} ignored (base or head not found)` : '',
  ].filter(Boolean);
  const note = noteParts.length ? `; ${noteParts.join('; ')}` : '';
  return { tip, baseRef, base, codeCommits, covers, uncovered, note };
}

/** The lines that both rows print for the code commits no Codex review record covers: one per commit, with its
 * short id and subject, newest first as `git log` lists them. Each row closes them with the command that
 * makes the record, from the base that row names. */
const uncoveredNames = (uncovered) => uncovered.map((commit) => `${commit.shortId} ${commit.subject}`);

/** What both rows say of a coverage that leaves no code commit uncovered, before its `note`. */
function coveredDetail({ codeCommits, base }) {
  return codeCommits.length
    ? `${codeCommits.length} code commit${codeCommits.length === 1 ? '' : 's'} since ${base}, all covered by a Codex review record`
    : `no code commits since ${base}`;
}

/** What the Codex review the pushed branch ends on still owes: `null` when it owes nothing, or when nothing
 * can be proven; `{ refuse: true, detail, lines }` when it owes a correction never rechecked; and
 * `{ refuse: false, lines }`, a warning the passing row carries, when a recheck left findings open.
 *
 * Why. A record covers its commits whatever its review found, so coverage alone let a branch push right
 * after Codex called its head incorrect (2026-10-14: two P2 findings, then "all covered by a Codex review
 * record"). The review the branch ends on is the last record that covers its newest code commit; what it
 * owes is what `codex-review` reads to decide whether the next range is a recheck (`recheckState`). So this
 * refuses the head whose next review would be a recheck, and nothing else. The head of a recheck that left
 * findings open passes with a warning that names them: a second recheck is not run, so refusing it would
 * leave a session away from the user no way forward, and whether a disputed finding is waived is the user's
 * call (decided 2026-10-15: no waiver, the warning is enough). Coverage is still read from the records alone (./lib/codex-review-runs.mjs says why);
 * the run log, where the findings are kept, only adds this refusal, and a log that cannot be read proves
 * nothing owed. Documents committed after that head change nothing here: they are no code commit. */
function correctionOwed(cwd, { codeCommits, covers }, { spawn }) {
  const newest = codeCommits[0];
  if (newest === undefined) return null;
  // Only a review of Codex's says what the code owes: a skip or a range that held nothing records no
  // review, so one written later, as to a document commit after the head, must not hide the debt.
  const last = covers.filter(({ rec, covered }) => rec.outcome === 'reviewed' && covered.has(newest.id)).at(-1);
  if (last === undefined) return null;
  const from = last.rec.head;
  let records;
  let runs;
  try {
    records = readCodexReviews(cwd, { spawn });
    runs = readCodexReviewRuns(cwd, { spawn });
  } catch {
    return null;
  }
  const state = recheckState({ from, records, runs });
  if (state.kind === 'review' || (state.kind === 'refused' && state.open === 0)) return null;
  const shortOf = (id) => gitOut(spawn, cwd, ['rev-parse', '--short', id]) ?? id.slice(0, 7);
  const findings = (n) => `${n} finding${n === 1 ? '' : 's'}`;
  if (state.kind === 'recheck') {
    const at = shortOf(from);
    return {
      refuse: true,
      detail: `the Codex review that ended at ${at} owes a correction: ${findings(state.findings.length)} open, not rechecked`,
      lines: [...state.findings.map(priorLine), `commit the correction, then recheck it: js-harness codex-review --base ${at}`],
    };
  }

  // A recheck that left findings open, which a second recheck may not take up: the recheck is the last
  // reviewed record that ends at `from` when it is one, else the last one of the findings that ended there.
  const reviewed = records.filter((rec) => isValidCodexReview(rec) && rec.outcome === 'reviewed');
  const atFrom = reviewed.filter((rec) => rec.head === from).at(-1);
  const recheck = typeof atFrom?.recheckOf === 'string' ? atFrom : reviewed.filter((rec) => rec.recheckOf === from).at(-1);
  const id = Array.isArray(recheck.runs) ? recheck.runs.at(-1) : recheck.run;
  const line = runs.findLast((one) => one?.id === id);
  const answered = runAnswerFindings(line);
  const prior = line?.recheck?.findings;
  // The findings it left open are those its answer marked not fixed or blocking, or did not mark, as
  // `codex-review` counted them; a line that kept no answer or no count lists none, and still refuses.
  const read = answered !== null && Number.isInteger(prior) ? classifyRecheck({ findings: answered }, prior) : null;
  const open = read === null ? [] : [...read.notFixed, ...read.blocking, ...read.unmarked];
  const at = shortOf(recheck.head);
  const left = state.open === null ? 'findings open (its counts were not kept)' : `${findings(state.open)} open`;
  return {
    refuse: false,
    lines: [
      `warning: the Codex recheck that ended at ${at} left ${left} of the review that ended at ${shortOf(state.of)}`,
      ...open.map(priorLine),
      // No skip is offered: a skip records no correction.
      `the push passes; the user decides whether they are waived, or a correction is committed as code and reviewed`,
    ],
  };
}

/** The `--push` row: every commit between the remote's default branch and `head` that changes a file
 * a review reads (not a document, not a path the project marks; a merge by the files somebody wrote
 * in it, so one that only brings two sides together needs none: `reviewCoverage`)
 * must lie in a range some `codex-review` record covers (any
 * outcome: an `unavailable` record is an explicit skip, and a `nothing-to-review` one a range that held
 * nothing for a review to look at, such as a change and its revert; both are listed), and the review the
 * branch ends on must owe no unrechecked correction (`correctionOwed`; a recheck that left findings open
 * passes with a warning that names them). Plain `check` never
 * runs it, because a slice under gentle-ai's review budget is committed before it is reviewed: what it
 * runs is `checkCodexReviewDebt`, which reads the same records and fails nothing. */
export function checkCodexReviews(cwd, head = 'HEAD', { spawn = spawnSync, remote = 'origin' } = {}) {
  // The switch is read at the commit pushed, before the remote is resolved: a project with the review off is
  // never refused for a remote this row cannot measure. One that cannot be read is read as on, and said.
  const git = gitIn(cwd, spawn);
  const tip = git(['rev-parse', '--verify', '--quiet', `${head}^{commit}`])?.trim();
  const atTip = tip ? codexSwitchAt(git, tip) : null;
  if (atTip?.value === 'off') {
    const row = { name: 'codex-review', pass: true, detail: `the Codex review is off at the pushed commit (${atTip.because}), so no record is asked for` };
    const turned = turnsReviewOff(cwd, git, spawn, remote, tip);
    return turned ? { ...row, lines: [turned] } : row;
  }
  const row = codexCoverageRow(cwd, head, { spawn, remote });
  if (!atTip?.errors.length) return row;
  return { ...row, lines: [...atTip.errors.map((error) => `read as on: ${error}`), ...(row.lines ?? [])] };
}

/** Whether the Codex review is off at the commit `head` of the repository `cwd` is in, read as `checkCodexReviews`
 * reads it (one that cannot be read is on). For the merge queue, whose code commits are then those that change a file
 * that is not Markdown (odd/tasks/rule-hierarchy.md, "The merge door (T16e)", item 5). */
export function codexReviewOffAt(cwd, head, { spawn = spawnSync } = {}) {
  const git = gitIn(cwd, spawn);
  const tip = git(['rev-parse', '--verify', '--quiet', `${head}^{commit}`])?.trim();
  return tip ? codexSwitchAt(git, tip).value === 'off' : false;
}

/** The Codex review's switch at the commit `rev`, read from that commit's own files: `{ value, because, errors }`. */
function codexSwitchAt(git, rev) {
  const { errors, resolved } = functionsOf(harnessOfCommit(git, rev), commitTree(git, rev));
  return { ...resolved.codexReview, errors };
}

/** The top of the working tree `cwd` is in: the nearest folder up from it that holds `.git` (a folder, or the
 * file of a worktree), found without starting git, since the rows that read it count their git processes.
 * `cwd` itself where none does. */
function topOf(cwd) {
  for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    if (path.dirname(dir) === dir) return cwd;
  }
}

/** The Codex review's switch in the working tree of the repository `cwd` is in, read at its top: `cwd` may be
 * a folder below it. Outside a repository, `cwd` itself. */
function codexSwitchHere(cwd, spawn) {
  const { errors, resolved } = functionsOf(harnessOfTree(topOf(cwd)), workingTree(gitIn(cwd, spawn)));
  return { ...resolved.codexReview, errors };
}

/** The line of a push that turns the review off where the default branch of `remote` has it on, or `null`:
 * the switch is the pushed commit's to say, and the push says it in plain sight. */
function turnsReviewOff(cwd, git, spawn, remote, tip) {
  const remotes = git(['remote'])?.split('\n').map((line) => line.trim()) ?? [];
  if (!remotes.includes(remote)) return null;
  const branch = defaultBranch(spawn, cwd, remote);
  if (!branch || codexSwitchAt(git, branch.ref).value !== 'on') return null;
  return `this push turns the Codex review off: it is on at ${branch.label} and off at ${git(['rev-parse', '--short', tip]).trim()}`;
}

/** git's empty tree: the base a diff of everything a commit holds is taken from. */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

/** The push row of the first push of a project to an empty repository, or `null` when it is not one. His
 * answer (odd/tasks/on-demand-functions.md, S10): it passes and says so, with what went unread and the
 * command that reviews it, which plans its cost first. It is one only where the remote holds no branch at all,
 * asked of the remote itself (`git ls-remote`), since a clone that never fetched holds no refs of a remote that
 * has branches; a remote that cannot be asked is no first push, and the row fails as before. */
function firstPushRow(cwd, head, { spawn, remote }) {
  const remotes = gitOut(spawn, cwd, ['remote'])?.split('\n').map((line) => line.trim()) ?? [];
  if (!remotes.includes(remote)) return null;
  if (gitOut(spawn, cwd, ['for-each-ref', '--count=1', '--format=%(refname)', `refs/remotes/${remote}/`]) !== '') return null;
  let listed;
  try {
    // Asked only where no ref of the remote is here, so once a project; a remote that does not answer in 20 s is
    // no first push, and the row fails as before rather than hold the push.
    listed = spawn('git', ['ls-remote', '--heads', remote], { cwd, encoding: 'utf8', timeout: 20000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  } catch {
    return null;
  }
  if (!listed || listed.error || listed.status !== 0 || listed.stdout.trim() !== '') return null;
  const tip = gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${head}^{commit}`]);
  const commits = tip && gitOut(spawn, cwd, ['rev-list', '--count', tip]);
  const roots = tip && gitOut(spawn, cwd, ['rev-list', '--max-parents=0', tip])?.split('\n').filter(Boolean);
  if (!commits || !roots?.length) return null;
  const first = roots[roots.length - 1].slice(0, 7);
  const size = reviewSize(spawn, cwd, EMPTY_TREE, tip);
  const unread = size === null ? 'git could not size them' : `${counted(size.changedLines, 'changed line')} in ${counted(size.files, 'file')}`;
  return {
    name: 'codex-review',
    pass: true,
    detail: `${remote} holds no branch yet, so this first push passes with no Codex review; from the next push on, every code commit is measured against what it leaves there`,
    lines: [
      `${counted(Number(commits), 'commit')} went unread by Codex: ${unread}`,
      `review them when you choose: js-harness codex-review --base ${first} --plan prints the cost and starts nothing; without --plan it reviews them`,
      `${first} itself, the first commit, is in no range: what it holds stays unread`,
    ],
  };
}

/** The push row with the review on: what the records say of the code commits pushed. */
function codexCoverageRow(cwd, head, { spawn, remote }) {
  const name = 'codex-review';
  const fail = (detail, lines) => ({ name, pass: false, detail, ...(lines ? { lines } : {}) });
  const state = codexReviewCoverage(cwd, head, { spawn, remote });
  if (state.unknown) return firstPushRow(cwd, head, { spawn, remote }) ?? fail(state.unknown.detail, state.unknown.lines);
  const { tip, baseRef, base, codeCommits, covers, uncovered, note } = state;
  if (uncovered.length) {
    // `git log` lists newest first, so the oldest uncovered commit is the last one.
    const oldest = uncovered[uncovered.length - 1];
    // A root commit has no `<id>^` to use as a base; a range from the unrelated default branch does
    // reach it, and `--unavailable` records a skip instead of a review. The command "makes the record",
    // not "the review": over a range with nothing to review it records that, and starts no review.
    // A merge is no root commit: its `<id>^` is the first of its parents, and the range from there holds
    // the merge and all it changed against that parent, what was written in it included.
    // The base is the one the plain row sizes (`checkCodexReviewDebt`): the parent of the oldest uncovered
    // commit only where a review can start there (`reviewStart`), else the default branch. Named as
    // `<oldest>^` alone, it was the `main` a branch left once `main` had been merged in after that commit,
    // and the range read again all `main` gained since (failure 15, 41 parts where 6 were due). With the
    // commits before the merge covered, that parent is the merge commit itself.
    const range = rangeStart(cwd, { base: baseRef, tip, spawn });
    const { before } = range.unknown ? { before: null } : reviewStart(uncovered, { cwd, from: range.from, tip, spawn });
    const hint = oldest.isRoot
      ? `${oldest.shortId} is a root commit, so ${oldest.shortId}^ does not exist; a range from the default branch reaches it: js-harness codex-review --base ${base} (add --unavailable <reason> to record a skip instead)`
      : `make the record with: js-harness codex-review --base ${before === null ? base : `${before.shortId}^`}`;
    const lines = [...uncoveredNames(uncovered), hint];
    return fail(`${uncovered.length} of ${codeCommits.length} code commit${codeCommits.length === 1 ? '' : 's'} since ${base} have no Codex review record (${codexReviewsPath(cwd, { spawn }) ?? 'no record file'})${note}`, lines);
  }

  const owed = correctionOwed(cwd, state, { spawn });
  if (owed?.refuse) return fail(`${owed.detail}${note}`, owed.lines);

  // The records that cover a code commit here and are no review of Codex's, each as a line that says which
  // it is and why: an explicit skip, or a range that held nothing to review. The detail counts the commits
  // as covered by a record, which they are; these lines are what keeps that from reading as "reviewed".
  const lines = notReviews(state).map((rec) => `${NOT_A_REVIEW[rec.outcome]} ${rec.base.slice(0, 7)}..${rec.head.slice(0, 7)}: ${rec.reason ?? 'no reason given'}`);
  if (owed !== null) lines.push(...owed.lines);
  return { name, pass: true, detail: `${coveredDetail(state)}${note}`, ...(lines.length ? { lines } : {}) };
}

/** `count` things with thousands separated and `noun` in the singular for one: `1 part`, `1,050 changed lines`. */
const counted = (count, noun) => `${String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ${noun}${count === 1 ? '' : 's'}`;

/** How large the review of `from..tip` is today, sized as `js-harness codex-review` sizes a range: how many
 * `parts` it is reviewed in at the default bound of a part, and the `changedLines` and `files` they hold,
 * which are those of the files a review reads; `leftOut` is how many files of the range it leaves out, by
 * the marks of the commit `tip`, as that command reads them. `null` when git cannot say. Renames are off,
 * as in that command. */
function reviewSize(spawn, cwd, from, tip, merge = null) {
  // The output ends with the NUL that ends its last record, which is no whitespace: `gitOut` trims nothing of it.
  // `--no-relative`, as for the commits (`reviewCoverage`): every file of the range, named from the top.
  // A merge of the default branch is sized by what was written in it, as that command reads it (`mergeStart`).
  const args = merge === null ? ['diff', '--numstat', '-z', '--no-renames', '--no-relative', from, tip] : rangeDiff({ from, head: tip, merge }, ['--numstat', '-z', '--no-relative']);
  const numstat = from === null ? null : gitOut(spawn, cwd, args);
  if (numstat === null) return null;
  try {
    const files = numstatFiles(numstat);
    const why = leftOutOf(files.map((file) => file.path), { cwd, source: tip, spawn });
    if (why === null) return null;
    const { read, leftOut } = reviewScope(files, why);
    return { parts: reviewParts(read).length, files: read.length, changedLines: read.reduce((sum, file) => sum + file.changedLines, 0), leftOut: leftOut.files };
  } catch {
    return null;
  }
}

/** The `codex-review` row of the plain check: how much code waits for a Codex review, said at every commit.
 * A branch once reached 28 parts of review because no slice was reviewed when it closed and nothing said the
 * debt was growing (odd/tasks/codex-review-cost.md); the `--push` row says it when the push is refused, and
 * by then the review is as large as it will get.
 *
 * Informational: it reads what the `--push` row reads (`codexReviewCoverage`, from the remote's default
 * branch to `HEAD`) and fails nothing, a state it cannot tell included. For the code commits no record
 * covers it says how many they are, names each one as the `--push` row does, with the command that makes
 * the record, and says how large the review that covers them is today: the review
 * `js-harness codex-review` would run, which starts where the records end (`reviewStart`, the one rule the
 * two share) and leaves out the files a review leaves out; and it names the command that prints the plan of
 * that review and starts nothing.
 *
 * It fails nothing by throwing either. Every git call under it answers `null` where it fails and the
 * records are read by a reader that passes over what it cannot read, but the plain check ran none of this
 * before the row existed: whatever still throws is said as what the row cannot tell, with what failed, and
 * the check goes on as it would have. The `--push` row has no such guard, and a throw under it stays loud. */
export function checkCodexReviewDebt(cwd, { spawn = spawnSync, remote = 'origin' } = {}) {
  const row = (detail, lines) => ({ name: 'codex-review', pass: true, info: true, detail, ...(lines?.length ? { lines } : {}) });
  const cannotTell = (why) => row(`cannot tell how much code waits for a Codex review: ${why}`);
  try {
    // Inside the guard: the switch is read from files and git as the rest is, and fails nothing either.
    const here = codexSwitchHere(cwd, spawn);
    if (here.value === 'off') return row(`the Codex review is off here (${here.because}): no code waits for one`);
    return codexReviewDebt(cwd, { spawn, remote }, { row, cannotTell });
  } catch (err) {
    return cannotTell(`reading the commits, their Codex review records or the size of their review failed (${err instanceof Error ? err.message : String(err)})`);
  }
}

/** What `checkCodexReviewDebt` says, made with its `row` and its `cannotTell`, and free to throw. */
function codexReviewDebt(cwd, { spawn, remote }, { row, cannotTell }) {
  const state = codexReviewCoverage(cwd, 'HEAD', { spawn, remote });
  // A fresh clone, a project with no remote, a folder that is no repository: this runs in all of them.
  if (state.unknown) return cannotTell(state.unknown.why ?? state.unknown.detail);
  const { tip, baseRef, base, codeCommits, uncovered, note } = state;
  if (uncovered.length === 0) {
    // Covered by a record is not reviewed: a skip and a range with nothing to review cover too. How many
    // such records there are is said; which they are is the push check's listing, not repeated at every commit.
    const others = notReviews(state).length;
    const said = others ? ` (${others} of the records that cover them ${others === 1 ? 'is' : 'are'} a skip or a range with nothing to review: js-harness check --push lists them)` : '';
    return row(`${coveredDetail(state)}${said}${note}`);
  }
  // The review that is sized is the one `js-harness codex-review` would run: it starts where that command
  // starts it (`reviewStart`), from the commit the range of the default branch starts at, which is `null`
  // where the two histories share none. That is the parent of the oldest uncovered commit, named as
  // `<id>^`, when a review can start there; where it cannot (a root commit has no `<id>^`, for one) the
  // push check names the default branch as the base that reaches every commit, and so does this.
  // Where git did not say which commit the range starts at, no start is known and none is sized: taken
  // for two histories that share none, a later start would be held to no commit (`rangeStart`).
  const range = rangeStart(cwd, { base: baseRef, tip, spawn });
  // A merge of the default branch at the tip, after a branch whose every other code commit has a record, is
  // reviewed from its first parent by what was written in it (`mergeStart`), and named as `<merge>^`.
  const merge = range.unknown || range.from === null ? null : mergeStart(cwd, { given: range.from, tip, spawn, remote });
  const atMerge = merge === null ? null : uncovered.find((commit) => commit.id === tip);
  const { start, before } = atMerge ? { start: merge.from, before: atMerge } : range.unknown ? { start: null, before: null } : reviewStart(uncovered, { cwd, from: range.from, tip, spawn });
  const baseArg = before === null ? base : `${before.shortId}^`;
  const one = reviewSize(spawn, cwd, start, tip, atMerge ? merge : null);
  // A merge of main below HEAD, after code commits that each have a record, is reviewed in two turns where they
  // cost less than the one review (`mergeTurn`, `turnsCheaper`): the command decides it so, and so does this.
  const turn = atMerge || one === null || range.unknown || range.from === null ? null : mergeTurn(cwd, { given: range.from, tip, uncovered, spawn, remote });
  // A merge that has the review off cannot be a turn of its own, as the command says of it (`cutInTurns`).
  const turnable = turn !== null && codexSwitchAt(gitIn(cwd, spawn), turn.merge).value !== 'off';
  const turnSizes = turnable ? [reviewSize(spawn, cwd, turn.from, turn.merge, turn), reviewSize(spawn, cwd, turn.merge, tip)] : null;
  const inTurns = turnSizes !== null && turnSizes.every((each) => each !== null) && turnsCheaper(one, turnSizes);
  const both = (key) => turnSizes[0][key] + turnSizes[1][key];
  const size = inTurns ? { parts: both('parts'), changedLines: both('changedLines'), files: both('files'), leftOut: both('leftOut') } : one;
  // More parts than a run starts by itself: the review is already one that has to be asked for by its count.
  const over = size !== null && size.parts > MAX_PARTS_WITHOUT_FLAG;
  let sized = `how large the review of ${baseArg}..HEAD is today could not be told`;
  if (size?.parts === 0) sized = `the review of ${baseArg}..HEAD has no part today, since the range changes no file ${size.leftOut > 0 ? 'a review reads ' : ''}as a whole`;
  else if (size) {
    const what = inTurns ? `2 turns today, the merge ${turn.merge.slice(0, 7)} by what was written in it and then the commits after it: ${counted(size.parts, 'part')}` : `${counted(size.parts, 'part')} today`;
    sized =
      `the review of ${baseArg}..HEAD is ${what}, ${counted(size.changedLines, 'changed line')} in ${counted(size.files, 'file')}` +
      (over ? `, already more parts than ${partsBound({ maxParts: MAX_PARTS_WITHOUT_FLAG, maxPartsGiven: false })}` : '');
  }
  return row(`no Codex review record for ${uncovered.length} of ${counted(codeCommits.length, 'code commit')} since ${base}: ${sized}${note}`, [
    // The base is the one the size above was read from, so the row names one review, not two.
    ...uncoveredNames(uncovered),
    `make the record with: js-harness codex-review --base ${baseArg}`,
    ...(over ? ['the cheaper way is to review now: every commit added to this range makes its review larger'] : []),
    `what it would cost, with nothing spent: js-harness codex-review --base ${baseArg} --plan`,
  ]);
}

/** The rules the sub-agent row reads, by id: a writer against the first, an explorer, reviewer or verifier
 * against the second, and every launch's effort against the third. */
const SUBAGENT_RULES = { writer: 'subagent-writer-model', reader: 'subagent-reader-model', effort: 'subagent-effort' };

/** Why a rule is not in force, as `ruleHere` names it: no rules file here, or one that is not the harness's list. */
const OFF_WHY = { elsewhere: 'this project keeps no bin/lib/rules-data.mjs', behind: "its bin/lib/rules-data.mjs is not the harness's list" };

/** `id` as `{ value, alias }` when `ruleHere` finds it in force in the rules text `text`, else `{ off }`. The alias
 * is `ruleOf`'s, null where the rule has none. */
function subagentRuleHere(id, text) {
  const here = ruleHere(id, undefined, text);
  return Object.hasOwn(here, 'value') ? { value: here.value, alias: ruleOf(id).alias ?? null } : { off: here.off };
}

/** The sub-agents row of `check --subagents` (odd/tasks/honesty-audit.md, T13): today's launches of this project,
 * each compared with the rules in force here, as information. It is opt-in because plain check is the commit gate
 * and a day of records is about 231 MB; only this row reads them.
 *
 * It fails nothing, as `checkCodexReviewDebt` does: a throw is said as what the row cannot tell. Where none of the
 * three rules is in force, one line says so and no record is read. A rule that is not in force is said beside the
 * others, and nothing is compared with it. `deps` takes the day's clock (`now`), the zone (`offsetMinutes`),
 * `homedir` and `run` (git, as `subagentsMain` takes it), so a test reads neither the real `~/.claude` nor the clock. */
export async function checkSubagents(cwd, env, { homedir = os.homedir, now = Date.now, offsetMinutes = -new Date().getTimezoneOffset(), run = (command, args, options) => spawnSync(command, args, { encoding: 'utf8', ...options }) } = {}) {
  const row = (detail, lines) => ({ name: 'subagents', pass: true, info: true, detail, ...(lines?.length ? { lines } : {}) });
  try {
    const read = readRulesData(cwd);
    if ('unreadable' in read) throw new Error(`the rules file cannot be read (${read.unreadable})`);
    const rules = Object.fromEntries(Object.entries(SUBAGENT_RULES).map(([side, id]) => [side, subagentRuleHere(id, read.text)]));
    const offRules = Object.entries(rules).filter(([, rule]) => 'off' in rule);
    if (offRules.length === Object.keys(rules).length) {
      const why = [...new Set(offRules.map(([, rule]) => OFF_WHY[rule.off]))].join('; ');
      return row(`the sub-agent rules are not in force here (${why}): no launch is compared`);
    }
    const notInForce = offRules.map(([side, rule]) => `not in force here: ${SUBAGENT_RULES[side]} (${OFF_WHY[rule.off]})`);
    const expected = {
      writerModel: 'off' in rules.writer ? null : rules.writer,
      readerModel: 'off' in rules.reader ? null : rules.reader,
      effort: 'off' in rules.effort ? null : rules.effort.value,
    };
    const day = dayOf(new Date(now()).toISOString(), offsetMinutes);
    const folders = recordFolders({ cwd: path.resolve(cwd), env, homedir, run });
    if (folders.length === 0) return row('no sub-agent launched today: no Claude Code records folder for this project', notInForce);
    const since = Date.parse(`${day}T00:00:00Z`) - offsetMinutes * 60_000;
    const { calls, records } = await readRecords(folders, { since, inWindow: () => false });
    const launches = launchesOf(records, { from: day, to: day, offsetMinutes, calls });
    const { detail, lines } = subagentRowLines(compareLaunches(launches, expected), expected);
    return row(detail, [...notInForce, ...lines]);
  } catch (err) {
    return row(`cannot tell: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export const USAGE = [
  'Usage: js-harness check [--cwd <path>] [--home <path>] [--remote <name>] [--wait <minutes> | --no-wait] [--first <reason>] [--subagents] | js-harness check --push [--head <rev>] [--remote <name>] [--ref <name>] [--cwd <path>] | js-harness check --door --base <rev> [--branch <name>] [--cwd <path>]',
  GATE_WAIT_USAGE,
  '       --first <reason>: issues this session a ticket for this tree and claims it as the gate arrives, so it goes before every gate that waits; for the orchestrator\'s batch run on main (odd/tasks/gate-first.md)',
  '       --door --base <rev> [--branch <name>]: runs only the rule rows over the lines <rev>..HEAD brings, judged by the running list, and the failures row, and exits 1 when one refuses (the merge door of merge-queue, odd/tasks/rule-hierarchy.md); --branch names the pull request\'s branch, which may change bin/lib/rules-data.mjs only when it is a rule/ branch',
].join('\n');

// A flag with no value (end of argv, or immediately followed by another `--flag`) is a usage
// error, not a silently-swallowed token that later crashes `path.join` with `undefined`.
class CheckArgError extends Error {}

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new CheckArgError(`${flag} requires a value`);
  return value;
}

/** How `argv` says to wait for the machine's gate lock, as `{ noWait, waitMinutes }`, for `check` and for
 * `js-harness gate`, which take the same two flags. `--wait <minutes>` is how long the lock may go without
 * changing hands before the gate gives up on it (an hour when it is not given; a fraction is taken, `0.5`
 * for thirty seconds). It is not a bound on the whole of a wait, which it was until 2026-10-11: counted
 * from the arrival, it refused a gate behind a line that moved, and a gate with four ahead of it lost its
 * hour and its place (`takeGateLock`). `--no-wait` refuses instead of waiting, for a holder and for a gate
 * that waits ahead in the line alike. Throws `CheckArgError` when `--wait` is given without a value or
 * with one that is not a number of minutes above zero, and when it comes with `--no-wait`, which says the
 * opposite. */
export function parseGateWait(argv) {
  const at = argv.indexOf('--wait');
  const wait = at !== -1 ? requireValue(argv, at, '--wait') : undefined;
  const noWait = argv.includes('--no-wait');
  if (wait !== undefined && !(/^\d+(\.\d+)?$/.test(wait) && Number(wait) > 0)) {
    throw new CheckArgError(`--wait takes a number of minutes above zero, not "${wait}"`);
  }
  if (wait !== undefined && noWait) throw new CheckArgError('--wait and --no-wait cannot be given together');
  return { noWait, waitMinutes: wait === undefined ? GATE_WAIT_MS / 60_000 : Number(wait) };
}

const VALUED_FLAGS = ['--cwd', '--home', '--head', '--remote', '--ref', '--wait', '--first', '--base', '--branch'];
const BARE_FLAGS = ['--push', '--no-wait', '--subagents', '--door'];
// The flags of a gate that runs sensors or waits for the lock, and `--home`, where that lock and the gate log live:
// `--door` uses none of them, so one of them with it is refused rather than ignored.
const GATE_FLAGS = ['--first', '--subagents', '--wait', '--no-wait', '--head', '--remote', '--home'];

/** Throws `CheckArgError` for the first token of `argv` that is no flag of `check` and no value of one.
 * A token it does not know was ignored until 2026-10-12, so `check --help` was a whole gate: it waited
 * for the lock and would have run the suite. The value after a flag that takes one is not looked at
 * here, whatever it is. */
function refuseUnknown(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    if (VALUED_FLAGS.includes(argv[i])) i += 1;
    else if (!BARE_FLAGS.includes(argv[i])) throw new CheckArgError(`unknown argument: ${argv[i]}`);
  }
}

/** Parses `argv`, matching `doctor.mjs`'s precedence: `--home` flag, then `env.JS_HARNESS_HOME`,
 * then `os.homedir()`. Throws `CheckArgError` when `--cwd`/`--home`/`--head`/`--remote`/`--wait` is given
 * without a value, for a `--wait` it cannot take (`parseGateWait`), and for an argument it does not know
 * (`refuseUnknown`). */
function parseArgs(argv, env) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? requireValue(argv, i, flag) : undefined;
  };
  // Read first, as it always was: a `--wait` that cannot be taken is said before any other flag's fault.
  const { noWait, waitMinutes } = parseGateWait(argv);
  refuseUnknown(argv);
  const first = get('--first');
  if (first !== undefined && first.trim() === '') throw new CheckArgError('--first needs a reason, not an empty one');
  if (first !== undefined && argv.includes('--push')) throw new CheckArgError('--first goes with a gate that runs its sensors, not with --push');
  const door = argv.includes('--door');
  const base = get('--base') ?? null;
  const branch = get('--branch') ?? null;
  if (door && base === null) throw new CheckArgError('--door needs --base <rev>: the lines it judges are <rev>..HEAD');
  if (door && argv.includes('--push')) throw new CheckArgError('--door goes with the rule rows, not with --push');
  const gate = GATE_FLAGS.find((flag) => door && argv.includes(flag));
  if (gate !== undefined) throw new CheckArgError(`--door runs no gate: ${gate} goes with a gate, not with --door`);
  if (!door && (base !== null || branch !== null)) throw new CheckArgError('--base and --branch go with --door');
  const ref = get('--ref') ?? null;
  if (ref !== null && !argv.includes('--push')) throw new CheckArgError('--ref goes with --push');
  return {
    ref,
    first: first?.trim(),
    cwd: get('--cwd') ?? process.cwd(),
    home: get('--home') ?? env.JS_HARNESS_HOME ?? os.homedir(),
    push: argv.includes('--push'),
    subagents: argv.includes('--subagents'),
    head: get('--head') ?? 'HEAD',
    remote: get('--remote') ?? 'origin',
    noWait,
    waitMinutes,
    door,
    base,
    branch,
  };
}

function formatRow(row) {
  const status = row.info ? 'INFO' : row.pass ? 'PASS' : 'FAIL';
  const lines = (row.lines ?? []).map((line) => `
      ${line}`).join('');
  return `${status}  ${row.name}  ${row.detail}${lines}`;
}

/** Runs all check rows and prints them; returns the process exit code. Exits 2, printing usage to
 * stderr and running no row, when a flag that takes a value is given without one, `--wait` is given a
 * value it cannot take, or an argument is given that `check` does not know (`parseArgs`). A gate whose
 * static row fails stops before its sensors: it prints the rows it has and one that says it stopped, and
 * exits 1 as that failure always made it. */
export async function main(argv = process.argv.slice(2), env = process.env, deps = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv, env);
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const { cwd, home, push, head, remote, noWait, waitMinutes, ref } = parsed;
  // The merge door runs the rule rows of the lines a pull request brings, and nothing else: no budget, no sensors, no lock.
  if (parsed.door) {
    const rows = [...checkDoor(cwd, { rules: deps.rules, spawn: deps.git, base: parsed.base, branch: parsed.branch }), ...checkFailures(cwd)];
    for (const row of rows) console.log(formatRow(row));
    return rows.every((row) => row.pass) ? 0 : 1;
  }
  // A push runs the Codex review row and the row `rules` of the lines it brings, as INFO. The budget, payload and sensor rows read the working tree,
  // not the commit being pushed, and the pre-commit gate already ran them on every commit.
  //
  // The other list is the static rows: all a gate knows of the working tree before its sensors, each in a
  // second or less. One of them that fails stops the gate before its sensors (below), whichever it is: the
  // rule names no row, so a row added to this list stops the gate by being in it. A row that states a rule
  // of the project (`rules`, `failures`) goes first in the list, before `budget`: it is the first thing a
  // reader of a stopped gate must see. A row that could not be computed stops the gate only if it is
  // written as a failure, and one that informs (`payload`) stops nothing.
  const rows = push
    ? [checkCodexReviews(cwd, head, { ...deps, remote }), ...checkPushRules(cwd, { rules: deps.rules, spawn: deps.git, head, remote }), ...checkTagRow(cwd, { ref, head, spawn: deps.git })]
    : [...checkOwnRules(cwd, { rules: deps.rules }), ...checkFailures(cwd), checkBudget(cwd), checkContracts(cwd), ...checkSpec(cwd), ...checkCitations(cwd), ...checkCommitSize(cwd), ...checkFunctions(cwd), ...checkPayload(cwd, home), ...checkExactCount(cwd, home), fixedLoadRow(cwd, home)];

  // The ledger of flaky tests (docs/FLAKY.md, `checkLedger`) is one more static row, read after the others.
  if (!push) rows.push(...checkLedger(cwd));

  // Guard against recursion: a sensor's suite may run check again (this repo's tests call `main`),
  // and that inner check must not spawn the sensors that are running it.
  // The sensors run under the machine's gate lock, taken in `home`, so two gates never run theirs
  // together. The inner check and a push run no sensor and so take no lock: the inner one could only
  // wait for the gate that runs it. Nor does a gate started by a process that holds the lock, which
  // says so with the mark of a held lock (`GATE_HELD_ENV`): it runs its sensors in that turn.
  // The gate of a commit that holds declared documents alone runs none of the project's sensors, and
  // takes no lock either (`checkSensors`): it runs the sensors of documents, where the project declares
  // them. The rows above ran all the same, so a contract it breaks still fails it.
  // A gate that runs sensors reads the machine's load before them, unless its environment switches that
  // off (`GATE_LOAD_ENV`, for a gate a test starts as a process of its own), and leaves its record in the
  // gate log of `home`, whatever the lock did, unless its environment switches that off (`GATE_LOG_ENV`).
  // The gate's file in the lock says which session of the host started it, where the host names one
  // (`CLAUDE_CODE_SESSION_ID`, read from the environment this was given, as `sessions` and `notify` read it).
  //
  // A gate whose static row has failed stops before its sensors: it hands `checkSensors` the names of the
  // rows that failed so far, and where that gate would have run its sensors it runs none, takes no lock and
  // answers one row that says so (`stoppedRow`). That row is then the last of the report: the `review` row
  // and the Codex debt inform about a change that is not going to be committed as it is, and are not
  // computed. The inner check and a push are outside this branch, and as they were.
  let stopped = false;
  if (!push && env.JS_HARNESS_CHECK_INNER !== '1') {
    const lock = env[GATE_HELD_ENV] === '1' ? { held: true, home } : { home, wait: !noWait, waitMinutes, session: env.CLAUDE_CODE_SESSION_ID || null, env, remote };
    // `--first`: the ticket is issued here and claimed as the gate arrives, as one the orchestrator issued is.
    const own = parsed.first === undefined ? null : ownTicketRows(parsed.first, cwd, lock, env, deps);
    if (own) rows.push(...own.rows);
    const stoppedBy = rows.filter((row) => row.pass === false).map((row) => row.name);
    const sensed = await checkSensors(cwd, deps, { ...lock, load: !loadSwitchedOff(env), log: !gateLogSwitchedOff(env), stoppedBy, wsl: readGateWsl(home, env) });
    rows.push(...sensed);
    // A ticket `--first` issued that this gate did not claim (no sensor ran under the lock) is cancelled: it was
    // for this one command, and a later check would otherwise jump the line with it (Codex).
    const unclaimed = own?.issued ? cancelTicket({ home, id: own.issued }) : null;
    if (unclaimed) {
      if (!gateLogSwitchedOff(env)) logTicket(home, 'first-cancelled', unclaimed, {}, { ...(deps.gateLog?.append && { append: deps.gateLog.append }) });
      rows.push({ name: 'first', pass: true, info: true, detail: `ticket ${unclaimed.id} was cancelled: this gate ran no sensor under the lock, so it claimed none` });
    }
    stopped = sensed.some((row) => row.stopped === true);
    // `deps.gentleAi` stands in for `spawnSync` here only, so a test can fake gentle-ai without touching the sensors.
    if (!stopped) rows.push(checkReview(cwd, { spawn: deps.gentleAi, git: deps.git }));
  }
  // How much code waits for a Codex review, said at every commit and failing none: the row that fails is the
  // push's. It reads commits and records, never the working tree, so the inner run prints it as well.
  // `deps.git` stands in for `spawnSync` here and where a gate asks git what is staged or what is untracked
  // in its working tree (`checkSensors`), since `deps.spawn` is what runs a sensor.
  // A clone that is not what its switches ask is said after the sensors, as the review is, and not by a gate
  // that stopped: it reads git, which a stopped gate asks nothing of.
  if (!push && !stopped) rows.push(...checkFunctionsPending(cwd, { spawn: deps.git }), checkCodexReviewDebt(cwd, { spawn: deps.git, remote }));
  // The sub-agents row runs only when asked (`--subagents`), since it reads a day of records, which a plain gate never does.
  if (!push && parsed.subagents) rows.push(await checkSubagents(cwd, env, deps));

  for (const row of rows) {
    console.log(formatRow(row));
  }
  for (const row of rows) {
    if (row.output) console.log(`\n${row.output}`);
  }

  return rows.every((row) => row.pass) ? 0 : 1;
}

/** Ends the process with `code` once what was printed to each of `streams` has been handed to the system,
 * one stream after the other. On a pipe, which is what a hook and a CI runner give `check`, a write on
 * POSIX is asynchronous and `process.exit` drops what is not written yet: the first run of the gate on
 * GitHub's Linux lost the end of a failed suite's output, its failures and its summary. The exit itself
 * stays immediate and is not left to the natural end of the process, so that a process a sensor left
 * running, or a handle nobody closed, never keeps a finished gate alive. A stream that cannot be written
 * any more (its reader is gone) still ends in the exit. `streams` and `exit` are injectable. */
export function exitWhenWritten(code, { streams = [process.stdout, process.stderr], exit = process.exit } = {}) {
  const [first, ...rest] = streams;
  if (!first) {
    exit(code);
    return;
  }
  first.write('', () => exitWhenWritten(code, { streams: rest, exit }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => exitWhenWritten(code));
}
