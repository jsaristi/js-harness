// `js-harness merge-queue`: the ready pull requests merged into main as one candidate (odd/tasks/merge-queue.md).
//
// The candidate is origin/main with each ready pull request merged into it in order of number, built in a
// worktree of its own under the git directory and removed before the command ends. A pull request is ready
// when nothing of its own keeps it from merging (`pullRequestProblems`), every code commit of it has a Codex
// review record (`checkCodexReviews`), and it merges into the candidate so far with no conflict. `--dry-run`
// builds and prints the candidate; `--land` tests it and moves main to it (`landCandidate`).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removableWorktrees } from './lib/worktrees.mjs';
import { allDocuments, checkCodexReviews, codexReviewOffAt, discoverDocuments, DOCUMENT_DIFF } from './check.mjs';
import { GATE_NOT_RUN } from './gate.mjs';
import { appendNotice, appendRelief, newNotice, NOTICE_TEXT_MAX, readNotices, reliefPath } from './lib/channel.mjs';
import { gatesOf, readGateLog } from './lib/gate-log.mjs';
import { COMMIT_FORMAT, gitOut, loggedCommits, reviewCoverage } from './lib/codex-review-coverage.mjs';
import { evidenceRefusal, gentleAiEvidence, GENTLE_AI_CUTOVER } from './lib/gentle-ai-evidence.mjs';
import { pullRequestProblems } from './lib/pull-request.mjs';
import { declarationOf, rulesOfText } from './lib/rules-change-run.mjs';
import { mainCheckout, projectSlug, roleOfTitle } from './lib/sessions.mjs';
import { REFRESH_FAILED, refreshCopy as refreshInstalledCopy } from './lib/refresh-copy.mjs';

export const USAGE = `Usage: js-harness merge-queue --dry-run | --land [--refresh-copy] | --prune [--cwd <path>]

Builds the candidate main would be: origin/main with each ready pull request merged into it in order of
number. Ready means open, not a draft, mergeable, based on main, a gentle-ai line in its body, a Codex
review record for every code commit, and no conflict with the candidate so far. A pull request GitHub
has not yet computed (mergeable UNKNOWN) is decided by its merge into the candidate. It names each pull
request it leaves out and why. Each pull request merged into the candidate passes main's rule rows first (check --door), and one that fails leaves the batch.
Each code commit committed after the cut-over (${GENTLE_AI_CUTOVER}) needs gentle-ai's evidence on its own branch: its
hash (seven characters or more), or a range a..b that holds it (a and what git rev-list a..b lists), on a line the
pull request adds to a feature document (odd/tasks/<name>.md) that says gentle-ai; a merge of main needs none. For
each ready pull request the queue prints, commit by commit, the Codex record that covers it and that line.

--dry-run builds and prints the candidate, tests and pushes nothing, and removes it before it ends.
--land tests the candidate: the whole suite on this machine under the gate lock, its gate first in the
line by a gate-first ticket for the running session (js-harness gate first; with no session id or a
refused ticket it waits its turn, and says which), and at the same time CircleCI's run of a queue/*
branch pushed for it before the suite starts. The branch is removed once the candidate is red or
untested on this machine, or once CircleCI answered. A candidate red or untested here still spends
that CircleCI run, and a land killed before it ends leaves its branch on origin for a hand to remove. When
both are green, main is pushed as the
candidate, by fast-forward from the main it was built from. A candidate whose every changed path is a
document main's harness.json declares runs no suite on this machine, as a commit of documents alone
runs none, and CircleCI's run is its test. A candidate red on this machine is
bisected: the pull request that turns it red is left out and named, and the rest is landed. The
pre-push hook refuses every other push of main. For each landed rule/ pull request and each rule it
changed in bin/lib/rules-data.mjs, the relief file gains one line, "rule:<id> landed on main <sha> from
<branch>: confirms relief line <n>", for the newest "rule:<id> proposed on <branch>, not landed" line whose
declaration hash is the landed head's that no later landing confirms; one with no such line is named. --dry-run and a land that does not move main
write none. A gate that ran nothing (no turn in time, or a waiting push took it) or was stopped before it
ended is no red: main is not pushed, and nothing is bisected. Exit 0 landed or nothing to land, 4 red,
3 main moved meanwhile (main not pushed), 5 the suite did not run or CircleCI gave no result in 30 minutes
(main not pushed), 1 anything else.
--land --refresh-copy, after a land that moved main, also brings the installed copy the hooks run up to that main
(odd/tasks/harness-review.md, T4): under the gate lock, the Claude settings are backed up (the newest five kept under
<home>/.js-harness/refresh-backups), main is installed with pnpm add -g by its sha in up to three tries, the copy is
verified by its --version (the version main's package.json names) and by the sha its shim names, then js-harness
install and js-harness doctor run, and the stale pnpm state is pruned. The undo is printed. A land that moved nothing
refreshes nothing and says so. Exit 6 when the copy is not verified or a step after the install fails (the landing
stands), 75 when the gate lock was not obtained (nothing refreshed).
A landed pull request whose branch moved during the land is named after the landing: its new commits
are not in main, so it needs another run of the queue.
Each --land appends one JSON line to <git common dir>/js-harness/lands.jsonl: the pull requests it looked at, each
one left out with its reason, the time of each suite run, of CircleCI (from the push of its queue branch, so it spans the local
suite, to its answer or the branch's removal) and of the push, what landed, and its exit.
A land tells the work session of each pull request it left out why, the failing tests of a red included, by a
note to that session's number in the channel; the session is the one whose newest ready notice names the pull
request (js-harness notify --kind ready --pr <n>), and none is told twice the same reason for one ready notice.
The record keeps, in each left-out entry, the failing tests of a red and the number of the session told.
After it lands, a land removes the worktree of each pull request it landed (git worktree remove, never --force)
when its head is in the main it pushed, git status shows nothing, ignored files included, its index has not
changed for 10 minutes, and it is not under .claude/worktrees or orca/workspaces (other apps' own), the main
one, locked, or the one the land runs from. The branch stays; the record names each one removed (removed). A removal that fails is said and changes
no exit.
--prune fetches origin and removes, by the same rule, every worktree on a branch origin/main holds, whatever
landed it; it asks about no pull request, moves nothing, writes no record and exits 0 unless git cannot fetch or
list the worktrees.`;

const TIMEOUT_MS = 60_000;

/** One land's record (odd/tasks/land-unattended.md, Design 4, B2), filled while the land runs and written
 * once as it ends: what the throughput command measures lands by. `file` is set only by a land that is not a
 * dry run and found its git directory; `said` keeps the last line the land printed. */
function landLog({ now, session }) {
  const iso = (ms) => new Date(ms).toISOString();
  const record = { v: 1, startedAt: iso(now()), endedAt: null, session, main: null, considered: [], leftOut: [], phases: [], circleci: null, candidate: null, landed: [], removed: [], exit: null, said: null };
  return {
    record,
    file: null,
    said(line) {
      record.said = String(line);
    },
    leave(pr, reason, said, extra = {}) {
      record.leftOut.push({ pr: pr.number, reason, said, ...extra });
    },
    /** Starts a phase; the function it returns ends it, `ok` true, false, or null for a run that judged nothing. */
    phase(name) {
      const at = now();
      return (ok) => record.phases.push({ phase: name, startedAt: iso(at), seconds: (now() - at) / 1000, ok });
    },
    write(exit) {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.appendFileSync(this.file, `${JSON.stringify({ ...record, endedAt: iso(now()), exit })}\n`);
    },
  };
}

/** The failing tests of a red suite run (`localSuite`), as a left-out entry keeps them: none where it named none. */
const redTests = (result) => (result.failing?.length ? { failing: result.failing } : {});

/** Says that `pr` is left out, and why (`line`), and records it in the land's record with its `reason` and
 * `said`, the line itself unless the cause has words of its own (a red's are the suite's). */
function leaveOut(log, stdout, pr, reason, line, { said = line, ...extra } = {}) {
  stdout(`PR ${pr.number} is left out: ${line}`);
  log.leave(pr, reason, said, extra);
}

function answer(run, command, args, cwd, timeout = TIMEOUT_MS, env = null) {
  let result;
  try {
    result = run(command, args, { cwd, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 64 * 1024 * 1024, ...(env ? { env: { ...process.env, ...env } } : {}) });
  } catch (err) {
    return { ok: false, status: null, out: '', err: err.message };
  }
  return { ok: !result?.error && result?.status === 0, status: result?.status ?? null, out: String(result?.stdout ?? ''), err: String(result?.stderr || result?.error?.message || '').trim() };
}

function parseArgs(argv) {
  const args = { dryRun: false, land: false, prune: false, refreshCopy: false, cwd: process.cwd() };
  for (let at = 0; at < argv.length; at += 1) {
    if (argv[at] === '--dry-run') args.dryRun = true;
    else if (argv[at] === '--land') args.land = true;
    else if (argv[at] === '--prune') args.prune = true;
    else if (argv[at] === '--refresh-copy') args.refreshCopy = true;
    else if (argv[at] === '--cwd' && at + 1 < argv.length) args.cwd = argv[(at += 1)];
    else return null;
  }
  // One mode, named: a run that pushes main is never what a bare command does. --refresh-copy is a part of --land.
  if (args.refreshCopy && !args.land) return null;
  return [args.dryRun, args.land, args.prune].filter(Boolean).length === 1 ? args : null;
}

/** How long the queue waits for CircleCI's result on a candidate, and how often it asks. */
const CI_WAIT_MS = 30 * 60_000;
const CI_POLL_MS = 30_000;
const RED = new Set(['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale']);

/** CircleCI's result on the commit `sha`, from GitHub: its check runs (the CircleCI GitHub app) and its
 * statuses (`ci/circleci...`, the OAuth integration). `{ state: 'green' | 'red' | 'pending', name, conclusion,
 * url }`; pending while it has posted nothing or something is still running. */
export function circleciState(checkRuns, statuses) {
  const runs = (checkRuns ?? []).filter((one) => /circleci/i.test(one?.app?.slug ?? ''));
  const posted = (statuses ?? []).filter((one) => /^ci\/circleci/i.test(one?.context ?? ''));
  const redRun = runs.find((one) => one.status === 'completed' && RED.has(one.conclusion));
  if (redRun) return { state: 'red', name: redRun.name, conclusion: redRun.conclusion, url: redRun.html_url };
  const redStatus = posted.find((one) => one.state === 'failure' || one.state === 'error');
  if (redStatus) return { state: 'red', name: redStatus.context, conclusion: redStatus.state, url: redStatus.target_url };
  const all = runs.length + posted.length;
  // Every run a success: a skipped or neutral run is no run of the suite, and green is the suite passing (Codex, 2026-10-14).
  const done = runs.every((one) => one.status === 'completed' && one.conclusion === 'success') && posted.every((one) => one.state === 'success');
  if (!(all > 0 && done)) return { state: 'pending' };
  // Named as a red is, so the land record keeps the build that passed (odd/tasks/land-unattended.md, B2).
  const [run] = runs;
  return run ? { state: 'green', name: run.name, conclusion: run.conclusion, url: run.html_url } : { state: 'green', name: posted[0].context, conclusion: posted[0].state, url: posted[0].target_url };
}

/** The rows of `status` (`FAIL`, `INFO`) in a `check` `output`. `check` prints its rows as one block, then each failed
 * sensor's output after a blank line (`main` of bin/check.mjs), and that output can hold a row a test printed; so the
 * rows are the first run of lines that begin with a row's status, up to the first blank line. */
function rowsWith(output, status) {
  return rowsAndLines(output, status).map((one) => one.row);
}

/** `rowsWith`, each row with the lines the gate indents under it (`{ row, lines }`), as the merge door gives its findings. */
function rowsAndLines(output, status) {
  const lines = String(output ?? '').split(/\r?\n/);
  const start = lines.findIndex((line) => /^(PASS|FAIL|INFO) {2}/.test(line));
  if (start === -1) return [];
  const rows = [];
  let current = null;
  for (const line of lines.slice(start)) {
    if (line.trim() === '') break;
    if (/^ {6}\S/.test(line)) {
      current?.lines.push(line.trim());
      continue;
    }
    current = line.startsWith(`${status}  `) ? { row: line.trim(), lines: [] } : null;
    if (current !== null) rows.push(current);
  }
  return rows;
}

/** The gate's own FAIL rows in its `output` (`rowsWith`). */
export function failedRows(output) {
  return rowsWith(output, 'FAIL');
}

/** The whole suite on the candidate at `place`, under the gate lock, by the candidate's own commands:
 * `{ ok, notRun, said }`. The land asks first for a gate-first ticket (`gate first`, for the session in `env`
 * and the tree `place`), so it does not wait behind the line, and `say`s whether it got one; with no session or
 * a refused ticket it waits its turn. A gate that exits `GATE_NOT_RUN` (no turn, or a waiting push took it) or
 * that is stopped before it ends ran nothing: `notRun`, which is no red (odd/tasks/land-unattended.md). */
/** The harness home a land reads and writes beside its gates: the relief file, the channel and the gate log. */
const harnessHomeOf = (env) => env.JS_HARNESS_HOME || os.homedir();

/** The names of the tests the last gate that ended at `place` found failing, from the gate log under `home`
 * (each sensor's `failing`); none where no gate there recorded any. Only gates that began at `since` (ms) or
 * later count: a bisection runs several suites in one folder, and an older red is not the run asked about
 * (Codex, 2026-10-17). */
export function failingTests(home, place, since = 0) {
  const at = (dir) => typeof dir === 'string' && path.resolve(dir).toLowerCase() === path.resolve(place).toLowerCase();
  const ran = gatesOf(readGateLog(home).events).filter((gate) => gate.start && gate.end && at(gate.start.cwd) && Date.parse(gate.start.at) >= since);
  for (const gate of ran.reverse()) {
    const names = (gate.end.sensors ?? []).flatMap((sensor) => (Array.isArray(sensor.failing) ? sensor.failing : []));
    if (names.length > 0) return names;
  }
  return [];
}

/** What a land tells the session of a pull request it left out (`out`, an entry of its record's `leftOut`): the
 * reason, what was said, and the failing tests of a red, cut to one notice. */
function leftOutText(out) {
  const failing = out.failing?.length ? ` Failing tests: ${out.failing.join('; ')}.` : '';
  const text = `PR ${out.pr} was left out of a land (${out.reason}): ${out.said.replace(/\.$/, '')}.${failing}`.replace(/\s*\n\s*/g, ' ');
  return text.length > NOTICE_TEXT_MAX ? `${text.slice(0, NOTICE_TEXT_MAX - 1)}…` : text;
}

/** A(b) (odd/tasks/land-unattended.md, Design 6): each pull request the land left out (`record.leftOut`) is
 * told to the work session whose newest `ready` notice names it, as a note to that session's number, so its
 * wait ends on it. Once a ready notice: the same text already told since that notice is not told again, and a
 * newer ready notice is told anew. Each entry gets `told`, the number told, or `null` where no work session's
 * ready notice names the pull request (the lead relays those). The channel is the project's (`home`, `slug`). */
export function tellLeftOut({ record, home, slug, now, stdout, readFile }) {
  for (const out of record.leftOut) out.told = null;
  const channel = readNotices(home, slug, readFile ? { readFile } : {});
  if (channel.unavailable !== undefined) {
    stdout(`Could not read the channel's record ${channel.path} (${channel.unavailable}): no session was told why its pull request was left out.`);
    return;
  }
  const from = { host: os.hostname(), id: null, source: 'merge-queue', title: 'js-harness merge-queue' };
  for (const out of record.leftOut) {
    const ready = channel.notices.findLast((notice) => notice.kind === 'ready' && notice.pr === out.pr);
    const owner = ready ? roleOfTitle(ready.from?.title) : null;
    if (owner?.role !== 'work') continue;
    const text = leftOutText(out);
    const since = Date.parse(ready.at);
    const told = channel.notices.some((notice) => notice.from?.source === 'merge-queue' && notice.to.number === owner.number && notice.text === text && Date.parse(notice.at) >= since);
    if (!told) {
      appendNotice(home, slug, newNotice({ at: new Date(now()).toISOString(), from, to: String(owner.number), kind: 'note', text }));
      stdout(`Told ${ready.from.title} why PR ${out.pr} was left out.`);
    }
    out.told = owner.number;
  }
}

export function localSuite(run, place, { env = process.env, say = () => {} } = {}) {
  const bin = path.join(place, 'bin', 'js-harness.mjs');
  const session = env.CLAUDE_CODE_SESSION_ID;
  let issued = null;
  if (!session) {
    say('No gate-first ticket for the land (no session id): it waits its turn in the gate line.');
  } else {
    const ticket = answer(run, process.execPath, [bin, 'gate', 'first', '--session', session, '--tree', place, '--minutes', '60', '--reason', 'the merge queue lands a candidate'], place);
    say(ticket.ok
      ? `The land goes first in the gate line: ${ticket.out.trim().split('\n')[0]}`
      : `No gate-first ticket for the land (${ticket.err.split('\n')[0] || `gate first exited ${ticket.status}`}): it waits its turn in the gate line.`);
    if (ticket.ok) issued = /^ticket ([0-9a-f]{8}):/.exec(ticket.out.trim())?.[1] ?? null;
  }
  const began = Date.now();
  const done = answer(run, process.execPath, [bin, 'gate', '--wait', '90', '--', process.execPath, path.join(place, 'bin', 'check.mjs')], place, 120 * 60_000);
  // A ticket the gate did not claim (it ran nothing, or an older candidate's gate claims none) would hold one
  // of the two open slots for an hour: cancelled. One the gate claimed is gone, and its cancel exits 1 unsaid.
  if (issued) answer(run, process.execPath, [bin, 'gate', 'first', '--cancel', issued], place);
  if (done.status === GATE_NOT_RUN) return { ok: false, notRun: true, said: done.err.split('\n')[0] || 'the gate ran nothing' };
  if (done.status === null) return { ok: false, notRun: true, said: `the gate was stopped before it ended${done.err ? ` (${done.err.split('\n')[0]})` : ''}` };
  const last = failedRows(done.out);
  const said = last.length ? last.join('; ') : 'the gate exited non-zero';
  // A red names its failing tests, as the gate log has them, for the session that is told (A(b)).
  const failing = done.ok ? [] : failingTests(harnessHomeOf(env), place, began);
  return { ok: done.ok, notRun: false, said, ...(failing.length > 0 && { failing }) };
}

/** The commits of `main..head` read in `cwd` that change a file that is not Markdown, newest first
 * (`{ id, shortId, parentCount, subject }`): the code commits of a project whose Codex review is off. A merge changes
 * the files it leaves as none of its parents has them (`--diff-merges=combined`), which is where an edit made in it
 * is; whether it needs a line is `gentleAiEvidence`'s call. `null` when git does not answer. */
function markdownlessCommits(cwd, main, head) {
  // The log `reviewCoverage` reads, by the same reader: names as git has them (`-z`), no signature before a commit.
  const log = gitOut(spawnSync, cwd, ['log', '-z', '--diff-merges=combined', '--root', '--no-show-signature', '--no-relative', '--no-renames', '--name-only', `--format=${COMMIT_FORMAT}`, `${main}..${head}`]);
  const commits = log === null ? null : loggedCommits(log);
  return commits === null ? null : commits.filter((commit) => commit.files.some((file) => !/\.md$/i.test(file)));
}

/** Whether the pull request at `head` is ready by its reviews, read in `cwd` against `main` (odd/tasks/rule-hierarchy.md,
 * "The merge door (T16e)", items 5 and 6): `{ pass, detail }` as `checkCodexReviews` gives it, refused when a code commit
 * committed after `cutover` has no gentle-ai line on its branch (`gentleAiEvidence`), and, when it passes, `lines`: one
 * for each code commit, with the Codex record that covers it and the gentle-ai line that names it, so the lead reads the
 * coverage commit by commit and needs no look of their own. */
export function reviewEvidence(cwd, main, head, { cutover = GENTLE_AI_CUTOVER } = {}) {
  const codex = checkCodexReviews(cwd, head);
  if (!codex.pass) return codex;
  const off = codexReviewOffAt(cwd, head);
  const coverage = off ? null : reviewCoverage(cwd, { from: main, tip: head });
  const codeCommits = off ? markdownlessCommits(cwd, main, head) : coverage.unknown ? null : coverage.codeCommits;
  if (codeCommits === null) return { pass: false, detail: 'its code commits could not be read' };
  const evidence = gentleAiEvidence(cwd, { main, head, codeCommits, cutover });
  if (evidence.unknown) return { pass: false, detail: 'its gentle-ai lines could not be read' };
  const refusal = evidenceRefusal(evidence);
  if (refusal !== null) return { pass: false, detail: refusal };
  const due = new Set(evidence.due.map((commit) => commit.id));
  const lines = codeCommits.map((commit) => {
    const record = coverage?.covers.find(({ covered }) => covered.has(commit.id))?.rec;
    const codexSaid = off ? 'the Codex review is off'
      : record ? `Codex ${record.base.slice(0, 7)}..${record.head.slice(0, 7)} ${record.outcome} ${record.reviewedAt.slice(0, 10)}`
        : 'no Codex record read for it';
    const named = evidence.where.get(commit.id);
    // A due commit no line names refused above, so one that is not named here is not due: a merge of main, or older.
    const notAsked = commit.parentCount > 1 ? 'a merge of main' : 'committed before the cut-over';
    const gentleSaid = named ? `gentle-ai ${named}` : `gentle-ai not asked, ${notAsked}`;
    return `${commit.shortId} ${commit.subject}: ${codexSaid}; ${gentleSaid}`;
  });
  return { pass: true, detail: codex.detail, lines };
}

/** Whether every path the candidate at `place` changes against `main` is a document that main's harness.json, in
 * main's worktree `mainPlace`, declares (`discoverDocuments`): then the suite does not run on this machine, as for a
 * commit of documents alone, and CircleCI's run of the whole gate is the candidate's test (the throughput plan's item 7,
 * 2026-10-16). Main's declaration, never the candidate's: a pull request cannot widen what counts as a document for
 * itself, and its harness.json is a path that is no document. A git that does not answer, a declaration that does not
 * parse, or an empty change runs the suite. */
function documentsAlone(gitIn, place, main, mainPlace) {
  const { documents, error } = discoverDocuments(mainPlace);
  if (error || documents.length === 0) return false;
  // The commit gate's own question and answer (`DOCUMENT_DIFF`, `allDocuments`), so the two never disagree.
  const diff = gitIn(place, 'diff', ...DOCUMENT_DIFF, main, 'HEAD');
  return diff.ok && allDocuments(diff.out.split('\0').filter(Boolean), documents);
}

const DOCUMENTS_ALONE = 'Every path the candidate changes is a document main\'s harness.json declares: the suite does not run on this machine, as for a commit of documents alone; CircleCI runs the whole gate on it.';

/** Whether main's check.mjs has the merge door (odd/tasks/rule-hierarchy.md, "The merge door (T16e)"): its source names
 * the `'--door'` flag. Read once per batch from main's worktree; a main without the file has no door yet. */
function mainHasDoor(checker) {
  try {
    return fs.readFileSync(checker, 'utf8').includes("'--door'");
  } catch {
    return false;
  }
}

/** The merge of `pr` into the candidate at `place`, then main's merge door on that merge (odd/tasks/rule-hierarchy.md,
 * "The merge door (T16e)"), run in the candidate's worktree on `HEAD^1..HEAD`. `door` is main's check.mjs, or `null`
 * when main has no door, and then nothing runs after the merge. Returns:
 * - `{ kind: 'merged', merge }` when the pull request stays (its merge commit); a head the candidate already has
 *   merges without a commit, and no door runs on it;
 * - `{ kind: 'conflict', conflicted, said }` when git does not merge it, the merge aborted, the candidate as it was;
 * - `{ kind: 'door', line }` when the door refuses it or does not answer: the candidate goes back to the commit it was
 *   before this merge, and `line` says why, with the lines the door indents under its FAIL rows;
 * - `{ kind: 'broken', line }` when the merge cannot be taken back, so the candidate is not known: nothing more may
 *   be merged or tested.
 * `--no-verify`: the repository's pre-merge-commit hook runs the gate on every merge, which the queue runs once on the
 * whole candidate instead (S6); under the hook a merge waited for a turn of the lock and was then refused, and read as a
 * conflict. The merge takes the identity the repository already has (no `git config` is written here). */
function mergeThroughDoor({ run, gitIn, place, door, pr, stdout }) {
  const commit = () => gitIn(place, 'rev-parse', 'HEAD').out.trim();
  const before = commit();
  const done = answer(run, 'git', ['merge', '--no-ff', '--no-verify', '--quiet', '-m', `Merge pull request #${pr.number} from ${pr.headRefName}`, pr.headRefOid], place);
  if (!done.ok) {
    const conflicted = gitIn(place, 'diff', '--name-only', '--diff-filter=U').out.split('\n').map((line) => line.trim()).filter(Boolean);
    gitIn(place, 'merge', '--abort');
    return { kind: 'conflict', conflicted, said: done.err.split('\n').find((line) => line.trim()) ?? 'git gave no reason' };
  }
  // A head the candidate has already merges without a commit: it brings no line, so no door runs on it.
  if (door === null || commit() === before) return { kind: 'merged', merge: commit() };
  // The door's code is main's, from main's worktree (`door`), and it reads only the lines this pull request brings.
  const ran = answer(run, process.execPath, [door, '--door', '--base', 'HEAD^1', '--branch', pr.headRefName], place);
  if (ran.ok) {
    const notes = rowsAndLines(ran.out, 'INFO');
    if (notes.length > 0) {
      stdout(`PR ${pr.number} notes from the merge door:`);
      for (const note of notes) {
        stdout(`  ${note.row}`);
        for (const line of note.lines) stdout(`      ${line}`);
      }
    }
    return { kind: 'merged', merge: commit() };
  }
  const taken = gitIn(place, 'reset', '--hard', before);
  if (!taken.ok) return { kind: 'broken', line: `could not take the merge of PR ${pr.number} back (${taken.err.split('\n')[0] || 'git gave no reason'}): nothing was pushed.` };
  if (ran.status === 1) {
    const rows = rowsAndLines(ran.out, 'FAIL').map((one) => [one.row, ...one.lines].join(': '));
    return { kind: 'door', line: `the merge door refuses it${rows.length > 0 ? `: ${rows.join('; ')}` : ' (no row says why)'}` };
  }
  return { kind: 'door', line: `the merge door did not answer (exit ${ran.status ?? 'none'})` };
}

/** The lines of the relief file `relief` that confirm the landing on main `sha` of the branch `branch` for the rules
 * `ids` it changed (odd/tasks/rule-hierarchy.md, "The merge door (T16e)", item 7): `{ lines, none }`. For each id, the
 * newest line "rule:<id> proposed on <branch>, not landed" (`js-harness rules change` writes it; the comma after the
 * branch keeps `rule/a` from matching `rule/ab`, the space after "proposed" `rule:a` from matching `rule:ab`) that no
 * later "rule:<id> landed on main ... from <branch>: " line confirms gets one line naming its place, from 1, blank lines
 * counted, as `rules change` names the line it supersedes; `none` are the ids no proposed line names. Only a proposal
 * the landed head holds counts: a line that ends "; declaration and source <hash>" when `sourced[id]` is that hash (the
 * head's declaration of the rule with its entry of `docs/rule-sources.json`, `declarationOf`); an older line that ends
 * "; declaration <hash>" when `declarations[id]` is that hash (the declaration alone); and an older line that names
 * neither when it is stamped before `until` (ms), the start of the second of the head's commit, since `rules change`
 * stamps its line before the commit that holds it. */
export function landingLines(relief, { branch, ids, sha, declarations = {}, sourced = {}, until = Infinity }) {
  const lines = String(relief).split('\n');
  const found = { lines: [], none: [] };
  for (const id of ids) {
    const proposal = `rule:${id} proposed on ${branch}, not landed`;
    const held = (line) => {
      const named = /; declaration( and source)? ([0-9a-f]{12}|none)\s*$/.exec(line);
      if (named === null) return stampOf(line) < until;
      return named[2] === (named[1] === undefined ? declarations : sourced)[id];
    };
    const newest = lines.findLastIndex((line) => line.includes(proposal) && held(line));
    if (newest === -1) {
      found.none.push(id);
      continue;
    }
    const confirmed = lines.slice(newest + 1).some((line) => line.includes(`rule:${id} landed on main `) && line.includes(` from ${branch}: `));
    if (!confirmed) found.lines.push(`rule:${id} landed on main ${sha} from ${branch}: confirms relief line ${newest + 1}`);
  }
  return found;
}

/** The local time an `appendRelief` line is stamped with, in ms; NaN for a line it did not stamp. */
function stampOf(line) {
  const stamp = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d) local /.exec(line);
  return stamp === null ? NaN : new Date(+stamp[1], stamp[2] - 1, +stamp[3], +stamp[4], +stamp[5], +stamp[6]).getTime();
}

const RULES_DATA = 'bin/lib/rules-data.mjs';
const RULE_SOURCES = 'docs/rule-sources.json';

/** The ids of the rules the branch at `head` changed against `main`, read at `place`: those whose declaration in
 * `bin/lib/rules-data.mjs` differs between `head` and its merge base with `main`, added and removed ones among them, so
 * what main gained since is not the branch's. `null` when git or the file does not answer. */
function changedRuleIds(gitIn, place, main, head) {
  const base = gitIn(place, 'merge-base', main, head);
  if (!base.ok) return null;
  const read = (commit) => {
    const shown = gitIn(place, 'show', `${commit}:${RULES_DATA}`);
    if (!shown.ok) return new Map();
    try {
      return new Map(rulesOfText(shown.out).map((rule) => [rule.id, JSON.stringify(rule)]));
    } catch {
      return null;
    }
  };
  const [before, after] = [read(base.out.trim()), read(head)];
  if (before === null || after === null) return null;
  return [...new Set([...before.keys(), ...after.keys()])].filter((id) => before.get(id) !== after.get(id));
}

/** After a land, one relief line for each rule a landed `rule/` pull request changed and `js-harness rules change`
 * proposed on that branch (`landingLines`), appended by `appendRelief` as the queue's; a pull request that leaves none
 * says why. The relief file is the project's (`home`, `slug`), as `notify` finds it. */
function recordLandings({ gitIn, place, main, candidate, merged, home, slug, now, stdout }) {
  for (const pr of merged.filter((one) => one.headRefName.startsWith('rule/'))) {
    const said = `PR ${pr.number} (${pr.headRefName}) landed`;
    const ids = changedRuleIds(gitIn, place, main, pr.headRefOid);
    if (ids === null) {
      stdout(`${said}, and the rules it changed could not be read: no landing line is written for it.`);
      continue;
    }
    if (ids.length === 0) {
      stdout(`${said} changing no rule of ${RULES_DATA}: no landing line is written for it.`);
      continue;
    }
    let relief = '';
    try {
      relief = fs.readFileSync(reliefPath(home, slug), 'utf8');
    } catch {
      // No relief file is no proposed line.
    }
    // What the landed head holds: each rule's declaration, alone and with its source, and its commit time for a proposal
    // line that names neither. A head with no sources file holds no source for any rule.
    const committed = Number(gitIn(place, 'show', '-s', '--format=%ct', pr.headRefOid).out.trim());
    const shown = gitIn(place, 'show', `${pr.headRefOid}:${RULES_DATA}`);
    const sourcesShown = gitIn(place, 'show', `${pr.headRefOid}:${RULE_SOURCES}`);
    let declarations = null;
    let sourced = {};
    try {
      if (shown.ok) declarations = Object.fromEntries(ids.map((id) => [id, declarationOf(shown.out, id)]));
    } catch {
      // A declaration file that does not parse is one the head cannot be matched by.
    }
    // A sources file that does not parse matches no line that names the source; a line that names the declaration
    // alone, or neither, is still matched.
    try {
      const sources = sourcesShown.ok ? JSON.parse(sourcesShown.out) : {};
      if (shown.ok) sourced = Object.fromEntries(ids.map((id) => [id, declarationOf(shown.out, id, sources)]));
    } catch {
      stdout(`${said}, and its ${RULE_SOURCES} does not parse: a relief line that names a rule with its source is not matched.`);
    }
    if (!Number.isFinite(committed) || committed <= 0 || declarations === null) {
      stdout(`${said}, and what its head holds could not be read: no landing line is written for it.`);
      continue;
    }
    const { lines, none } = landingLines(relief, { branch: pr.headRefName, ids, sha: candidate.slice(0, 7), declarations, sourced, until: committed * 1000 });
    for (const id of none) stdout(`${said} with no relief line "rule:${id} proposed on ${pr.headRefName}, not landed": no landing line is written for it.`);
    for (const line of lines) {
      try {
        stdout(`Relief: ${appendRelief(home, slug, line, now(), 'merge-queue').line}`);
      } catch (err) {
        stdout(`Could not append to the relief file (${err.message}): ${line}`);
      }
    }
  }
}

/** `--land`: the candidate at `place`, built on `main`, tested on this machine and on CircleCI at once, and main
 * moved to it when both are green (S6, S7). Its CircleCI run is that of a `queue/*` branch pushed for it before
 * the local suite starts (odd/tasks/land-unattended.md, D) and removed as soon as its answer no longer matters:
 * once the candidate is red or untested here, or once CircleCI answered. Main moves by fast-forward only,
 * leased on the `main` the candidate was built from: a main that moved in between is left as it is (exit 3).
 * Red anywhere is exit 4. */
async function landCandidate({ run, gitIn, place, main, door, merged, suite, sleep, stdout, fail, landed, log }) {
  const candidate = gitIn(place, 'rev-parse', 'HEAD').out.trim();
  if (!candidate) return fail('could not read the candidate.');
  log.record.candidate = candidate;
  // CircleCI starts with the local suite, not after it: the two ran in series, about 2.8 minutes a land. The cost
  // is one CircleCI run spent on each candidate this machine turns red or does not test. Main still waits for both greens.
  // `--no-verify`: the branch is the candidate's run on CircleCI, and no hook judges it; main's push is judged.
  const branch = `queue/${new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '')}-${candidate.slice(0, 7)}`;
  if (!gitIn(place, 'push', '--quiet', '--no-verify', 'origin', `${candidate}:refs/heads/${branch}`).ok) return fail(`could not push ${branch}.`);
  const ciEnded = log.phase('circleci');
  let ci = { state: 'pending' };
  let [asked, dropped] = [false, false];
  // Removes the queue branch once, and ends the CircleCI phase: `dropped` when its answer was not waited for.
  const drop = () => {
    if (dropped) return;
    dropped = true;
    ciEnded(ci.state === 'green' ? true : ci.state === 'red' ? false : null);
    const state = !asked ? 'dropped' : ci.state === 'pending' ? 'none' : ci.state;
    log.record.circleci = { state, name: ci.name ?? null, conclusion: ci.conclusion ?? null, url: ci.url ?? null };
    const removed = gitIn(place, 'push', '--quiet', '--no-verify', 'origin', '--delete', branch);
    // Named, never silent: a queue branch origin keeps runs nothing more, and only a hand removes it.
    if (!removed.ok) stdout(`Could not remove ${branch} from origin (${removed.err.split('\n')[0] || 'git gave no reason'}): remove it by hand.`);
  };
  try {
    // A suite that did not run judged nothing: no red to bisect, and no main to push (odd/tasks/land-unattended.md).
    const notRun = (result) => {
      drop(); // before the exit line, so a branch origin keeps is named above it and the record keeps the exit
      stdout(`The suite did not run on this machine (${result.said}): main was not pushed, and nothing was bisected.`);
      return 5;
    };
    const local = suite(place);
    if (local.notRun) return notRun(local);
    if (!local.ok) drop();
    if (!local.ok && merged.length > 1) {
      // Bisected (S8): the candidate of the first k pull requests is the commit after the k-th merge, so the
      // shortest red prefix names the pull request that turns it red. It leaves, the ones after it are merged
      // again on the green prefix, and that candidate is landed as any other.
      // A reset that fails leaves another tree in place, and its suite would judge the wrong pull request.
      const resetTo = (commit, what) => {
        const reset = gitIn(place, 'reset', '--quiet', '--hard', commit);
        return reset.ok ? null : fail(`could not reset the candidate to ${what} (${reset.err.split('\n')[0] || 'git gave no reason'}): main was not pushed.`);
      };
      // `red` is the run of the shortest red candidate found so far: its words and failing tests are the culprit's.
      let [low, high, red] = [1, merged.length, local];
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const failed = resetTo(merged[mid - 1].merge, `the merge of PR ${merged[mid - 1].number}`);
        if (failed !== null) return failed;
        const half = suite(place);
        if (half.notRun) return notRun(half);
        if (half.ok) low = mid + 1;
        else [high, red] = [mid, half];
      }
      const culprit = merged[low - 1];
      leaveOut(log, stdout, culprit, 'red', `the candidate turns red on this machine when it is merged (${red.said}).`, { said: red.said, ...redTests(red) });
      const failed = low > 1 ? resetTo(merged[low - 2].merge, `the merge of PR ${merged[low - 2].number}`) : resetTo(main, 'main');
      if (failed !== null) return failed;
      const kept = merged.slice(0, low - 1);
      for (const pr of merged.slice(low)) {
        // Merged again, so its door runs again on the shorter candidate (odd/tasks/rule-hierarchy.md, "The merge door (T16e)").
        const step = mergeThroughDoor({ run, gitIn, place, door, pr, stdout });
        if (step.kind === 'merged') kept.push({ ...pr, merge: step.merge });
        else if (step.kind === 'broken') return fail(step.line);
        else if (step.kind === 'door') leaveOut(log, stdout, pr, 'door', `${step.line}.`);
        else leaveOut(log, stdout, pr, 'merge', `it does not merge into the candidate without PR ${culprit.number}.`);
      }
      if (kept.length === 0) {
        stdout('No pull request is left to land: main was not pushed.');
        return 4;
      }
      return landCandidate({ run, gitIn, place, main, door, merged: kept, suite, sleep, stdout, fail, landed, log });
    }
    if (!local.ok) {
      // One pull request (alone, or the last a bisection kept) is the one that turned it red (Codex, 2026-10-17).
      log.leave(merged[0], 'red', local.said, redTests(local));
      stdout(`The candidate is red on this machine (${local.said}): main was not pushed.`);
      return 4;
    }
    if (!local.skipped) stdout(`The candidate ${candidate.slice(0, 7)} is green on this machine.`);
    asked = true;
    for (let waited = 0; waited <= CI_WAIT_MS; waited += CI_POLL_MS) {
      const read = (what) => {
        try {
          return JSON.parse(answer(run, 'gh', ['api', `repos/{owner}/{repo}/commits/${candidate}/${what}`], place).out);
        } catch {
          return null;
        }
      };
      // A read that fails is asked again at the next turn, never taken for an empty answer (Codex, 2026-10-14).
      const [checks, statuses] = [read('check-runs')?.check_runs, read('status')?.statuses];
      ci = Array.isArray(checks) && Array.isArray(statuses) ? circleciState(checks, statuses) : { state: 'pending' };
      if (ci.state !== 'pending') break;
      await sleep(CI_POLL_MS);
    }
    drop();
    if (ci.state === 'red') {
      stdout(`The candidate is red on CircleCI (${ci.name}: ${ci.conclusion}, ${ci.url}): main was not pushed.`);
      return 4;
    }
    if (ci.state !== 'green') {
      stdout(`CircleCI gave no result for the candidate in ${CI_WAIT_MS / 60_000} minutes: main was not pushed.`);
      return 5; // no answer judged nothing: not red (harness review b2)
    }
    stdout(`The candidate ${candidate.slice(0, 7)} is green on CircleCI.`);
    // The one push of main the pre-push hook lets through: it says it is the queue's (S9).
    const pushEnded = log.phase('push');
    const pushed = answer(run, 'git', ['push', '--quiet', `--force-with-lease=refs/heads/main:${main}`, 'origin', `${candidate}:refs/heads/main`], place, TIMEOUT_MS, { JS_HARNESS_MERGE_QUEUE: '1' });
    if (pushed.ok) pushEnded(true);
    else {
      const now = gitIn(place, 'ls-remote', 'origin', 'refs/heads/main').out.split('\t')[0];
      pushEnded(now === candidate);
      // A push that reached origin and lost its answer, as a timeout loses it: main is the candidate, landed.
      if (now === candidate) {
        stdout(`The push of main reported a failure (${pushed.err.split('\n')[0] || 'git gave no reason'}), and origin's main is the candidate all the same.`);
      } else if (now && now !== main) {
        stdout('Main moved while the candidate was tested: nothing was pushed to main; run the queue again.');
        return 3;
      } else {
        return fail(`could not push main: ${pushed.err.split('\n')[0] || 'git gave no reason'}.`);
      }
    }
    log.record.landed = merged.map((pr) => pr.number);
    log.landedBranches = new Map(merged.map((pr) => [pr.headRefName, pr.number]));
    stdout(`Landed: main ${main.slice(0, 7)} is now ${candidate.slice(0, 7)}, with ${merged.map((pr) => `PR ${pr.number}`).join(', ')}.`);
    // Main has moved: the relief's lines never turn a land into a failure.
    try {
      landed(candidate, merged);
    } catch (err) {
      stdout(`Could not write the landing lines of the relief file (${err.message}): main moved all the same.`);
    }
    // A head pushed after the candidate merged it is not in main, and GitHub leaves its pull request open: named,
    // so it is landed again. The push of main is not undone for it: the candidate was tested whole (lead, 2026-10-15).
    const refs = gitIn(place, 'ls-remote', 'origin', ...merged.map((pr) => `refs/heads/${pr.headRefName}`));
    if (!refs.ok) {
      stdout(`Could not read the heads of the landed pull requests (${refs.err.split('\n')[0] || 'git gave no reason'}): check none moved during the land.`);
      return 0;
    }
    const heads = new Map(refs.out.split('\n').filter(Boolean).map((line) => line.split('\t').reverse()));
    for (const pr of merged) {
      const head = heads.get(`refs/heads/${pr.headRefName}`);
      if (head && head !== pr.headRefOid) stdout(`PR ${pr.number} moved to ${head.slice(0, 7)} during the land; its new commits are not in main.`);
    }
    return 0;
  } finally {
    drop();
  }
}

/** After a land, removes the worktree of each landed pull request that can go with nothing lost (`removableWorktrees`:
 * on its branch, clean, idle, its head in the main the land pushed) with `git worktree remove`, never `--force`; the
 * branch stays. Each one removed is named in the land's record (odd/tasks/land-unattended.md, T9). */
function removeLandedWorktrees({ cwd, run, now, log, stdout }) {
  const gitIn = (dir, ...gitArgs) => answer(run, 'git', gitArgs, dir);
  const found = removableWorktrees({ cwd, base: log.record.candidate, branches: new Set(log.landedBranches.keys()), gitIn, now });
  if (found === null) {
    stdout('Could not list the worktrees: no worktree of a landed pull request was removed.');
    return;
  }
  for (const tree of found) {
    const pr = log.landedBranches.get(tree.branch);
    const removed = gitIn(cwd, 'worktree', 'remove', tree.path);
    if (!removed.ok) {
      stdout(`Could not remove the worktree of PR ${pr} at ${tree.path} (${removed.err.split('\n')[0] || 'git gave no reason'}): it stays.`);
      continue;
    }
    log.record.removed.push({ pr, path: tree.path });
    stdout(`Removed the worktree of PR ${pr} at ${tree.path}: its branch ${tree.branch} is in main, and the worktree was clean and idle. The branch stays.`);
  }
}

/** `--prune`: removes every worktree `removableWorktrees` gives against origin/main once fetched, whatever landed its
 * branch (odd/tasks/land-unattended.md, T10), as a land removes those of its own pull requests. No land record. */
function pruneRun(args, { run = spawnSync, now = Date.now, stdout, stderr }) {
  const gitIn = (dir, ...gitArgs) => answer(run, 'git', gitArgs, dir);
  if (!gitIn(args.cwd, 'fetch', '-q', 'origin').ok) {
    stderr('merge-queue: could not fetch origin.');
    return 1;
  }
  const base = gitIn(args.cwd, 'rev-parse', '--verify', '--quiet', 'origin/main').out.trim();
  const found = base ? removableWorktrees({ cwd: args.cwd, base, gitIn, now }) : null;
  if (found === null) {
    stderr(`merge-queue: could not ${base ? 'list the worktrees' : 'read origin/main'}: none was removed.`);
    return 1;
  }
  let removed = 0;
  for (const tree of found) {
    const done = gitIn(args.cwd, 'worktree', 'remove', tree.path);
    if (!done.ok) {
      stdout(`Could not remove the worktree at ${tree.path} (${done.err.split('\n')[0] || 'git gave no reason'}): it stays.`);
      continue;
    }
    removed += 1;
    stdout(`Removed the worktree at ${tree.path}: its branch ${tree.branch} is in origin/main, and the worktree was clean and idle. The branch stays.`);
  }
  stdout(`${removed} worktree${removed === 1 ? '' : 's'} removed.`);
  return 0;
}

export async function mergeQueueMain(argv = process.argv.slice(2), deps = {}) {
  const { env = process.env, now = Date.now, stdout: printOut = console.log, stderr: printErr = console.error } = deps;
  if (argv.includes('--help') || argv.includes('-h')) {
    printOut(USAGE);
    return 0;
  }
  const args = parseArgs(argv);
  if (args === null) {
    printErr(USAGE);
    return 2;
  }
  if (args.prune) return pruneRun(args, { ...deps, stdout: printOut, stderr: printErr });
  // Every line the run prints passes through the land's record, which keeps the last as its `said`.
  const log = landLog({ now, session: env.CLAUDE_CODE_SESSION_ID || null });
  const stdout = (line) => {
    log.said(line);
    printOut(line);
  };
  const stderr = (line) => {
    log.said(line);
    printErr(line);
  };
  const code = await queueRun(args, { ...deps, stdout, stderr, log });
  if (code === 0 && log.landedBranches?.size > 0) {
    // Outside the record's `said`, as telling is: what the land did ended with main moved. A removal that fails
    // changes no exit.
    try {
      removeLandedWorktrees({ cwd: args.cwd, run: deps.run ?? spawnSync, now, log, stdout: printOut });
    } catch (err) {
      printOut(`Could not remove the worktrees of the landed pull requests (${err.message}): the land's exit stands.`);
    }
  }
  let exit = code;
  if (args.refreshCopy) {
    // After the land and its removals, as the lead ran update-copy.sh after a land. Only a refresh that fails changes
    // the exit (REFRESH_FAILED, GATE_NOT_RUN): the landing it follows already stands.
    const landed = code === 0 && (log.landedBranches?.size ?? 0) > 0;
    const sha = landed ? log.record.candidate : null;
    let refreshed;
    try {
      refreshed = await (deps.refreshCopy ?? refreshInstalledCopy)({
        landed,
        sha,
        version: landed ? versionAt(sha, args.cwd, deps.run ?? spawnSync) : null,
        home: harnessHomeOf(env),
        cwd: args.cwd,
        env,
        session: env.CLAUDE_CODE_SESSION_ID || null,
        stdout: printOut,
        stderr: printErr,
      });
    } catch (err) {
      // A refresh that threw still lets the land record below be written: main has moved whatever the refresh did.
      printErr(`refresh failed: ${err.message}`);
      refreshed = REFRESH_FAILED;
    }
    exit = refreshed === 0 ? code : refreshed;
  }
  if (log.file && log.record.leftOut.length > 0) {
    // After the land's own last line, and not as its `said`: telling is no part of what the land did. A notice
    // that cannot be written changes no exit either.
    try {
      const run = deps.run ?? spawnSync;
      const slug = projectSlug(mainCheckout((command, gitArgs, options) => run(command, gitArgs, { ...options, encoding: 'utf8' }), args.cwd));
      tellLeftOut({ record: log.record, home: harnessHomeOf(env), slug, now, stdout: printOut });
    } catch (err) {
      printOut(`Could not tell the sessions of the pull requests left out (${err.message}): the land's exit stands.`);
    }
  }
  if (log.file) {
    // Written after the land ended, whatever its end: a record that cannot be written changes no exit.
    try {
      // The land's own exit: a refresh that failed after it is no part of what the land did.
      log.write(code);
    } catch (err) {
      stdout(`Could not write the land record to ${log.file} (${err.message}): the land's exit stands.`);
    }
  }
  return exit;
}

/** The version the package.json of `sha` names, read by git, or null when it names none (the copy's refresh says so). */
function versionAt(sha, cwd, run) {
  const shown = answer(run, 'git', ['show', `${sha}:package.json`], cwd);
  if (!shown.ok) return null;
  try {
    return JSON.parse(shown.out).version ?? null;
  } catch {
    return null;
  }
}

/** The files under `dir`, as paths relative to it with forward slashes. */
function copyFiles(dir, folder = '') {
  return fs.readdirSync(path.join(dir, folder), { withFileTypes: true }).flatMap((entry) => {
    const rel = folder ? `${folder}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return copyFiles(dir, rel);
    return entry.isFile() ? [rel] : [];
  });
}

/**
 * The bin/ files package.json `files` leaves out of an installed copy: the globs of its `!bin/` negations. A path
 * main holds that such a glob matches is no stale path when the copy lacks it. The test in merge-queue.test.mjs reads
 * package.json and fails if the two disagree.
 */
export const UNSHIPPED_GLOBS = ['*.test.mjs', '*.testkit.mjs'];
const unshipped = (repoPath) =>
  UNSHIPPED_GLOBS.some((glob) => new RegExp(`(^|/)${glob.replace(/\./g, '\\.').replace(/\*/g, '[^/]*')}$`).test(repoPath));

/** The git blob id of `bytes`, as `git hash-object` gives it: the sha1 of `blob <length>`, a NUL and the bytes. */
const blobId = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

/**
 * The bin/ paths the running copy and `main` do not agree on (sorted). One `git ls-tree` gives the blob id of each bin/ path of
 * `main`, and a file of the copy whose id is that one is the same file, with no more git call. The bytes are hashed with line ends
 * as LF, which is how a checkout on this machine holds them, so a blob stored with CRLF misses at the first look and is judged
 * further: `git show main:<path>` with line ends aside, as before. A path on one side only is stale. The running copy's bin/ is the
 * folder of `self`. An unreadable file is not proven different, and an unreadable listing refuses nothing, as before the guard;
 * a main without bin/merge-queue.mjs holds no queue to guard, so nothing is compared.
 */
export function staleBin(self, main, gitIn) {
  const dir = path.dirname(self);
  const listed = gitIn('ls-tree', '-r', main, '--', 'bin');
  if (!listed.ok) return [];
  const onMain = new Map();
  for (const line of listed.out.split('\n')) {
    const entry = /^\S+ \S+ ([0-9a-f]+)\t(.+)$/.exec(line);
    if (entry) onMain.set(entry[2], entry[1]);
  }
  if (!onMain.has('bin/merge-queue.mjs')) return [];
  let local;
  try {
    local = copyFiles(dir);
  } catch {
    return [];
  }
  const copied = new Set(local.map((rel) => `bin/${rel}`));
  const stale = [];
  for (const rel of local) {
    const repoPath = `bin/${rel}`;
    if (!onMain.has(repoPath)) {
      stale.push(repoPath);
      continue;
    }
    let mine = null;
    try {
      mine = fs.readFileSync(path.join(dir, rel)).toString('utf8').replace(/\r\n/g, '\n');
    } catch {
      continue;
    }
    if (blobId(Buffer.from(mine, 'utf8')) === onMain.get(repoPath)) continue;
    const theirs = gitIn('show', `${main}:${repoPath}`);
    if (theirs.ok && mine !== theirs.out.replace(/\r\n/g, '\n')) stale.push(repoPath);
  }
  for (const repoPath of onMain.keys()) if (!copied.has(repoPath) && !unshipped(repoPath)) stale.push(repoPath);
  return stale.sort();
}

async function queueRun(args, { run = spawnSync, covered = null, cutover = GENTLE_AI_CUTOVER, suite = null, env = process.env, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), self = fileURLToPath(import.meta.url), stdout, stderr, log }) {
  const cwd = args.cwd;
  const fail = (line) => {
    stderr(`merge-queue: ${line}`);
    return 1;
  };
  const gitIn = (dir, ...gitArgs) => answer(run, 'git', gitArgs, dir);

  // The git directory, read first so a land that fails at once still leaves its record (B2); a dry run leaves none.
  const common = gitIn(cwd, 'rev-parse', '--git-common-dir').out.trim();
  if (common && !args.dryRun) log.file = path.join(path.resolve(cwd, common), 'js-harness', 'lands.jsonl');
  if (!gitIn(cwd, 'fetch', '-q', 'origin').ok) return fail('could not fetch origin.');
  const main = gitIn(cwd, 'rev-parse', 'origin/main').out.trim();
  if (!main) return fail('could not read origin/main.');
  log.record.main = main;
  // A land run from a merge-queue that is not main's runs code main no longer has: the lead's lands ran a stale
  // checkout's, so D and B2 never ran (odd/tasks/land-unattended.md, L17). Only where main holds the queue: a
  // project that runs the installed harness has none of its own. Line ends do not count.
  if (args.land) {
    const stale = staleBin(self, main, (...gitArgs) => gitIn(cwd, ...gitArgs));
    if (stale.length) {
      const named = stale.slice(0, 3).join(', ') + (stale.length > 3 ? ` and ${stale.length - 3} more` : '');
      return fail(`${self} is not origin/main's bin/ (differs: ${named}): a land run from it would run code main no longer has. Land from a checkout at origin/main.`);
    }
  }
  const isCovered = covered ?? ((head) => reviewEvidence(cwd, main, head, { cutover }));
  let listed;
  try {
    listed = JSON.parse(answer(run, 'gh', ['pr', 'list', '--state', 'open', '--base', 'main', '--limit', '100', '--json', 'number,state,isDraft,mergeable,baseRefName,body,headRefOid,headRefName'], cwd).out);
  } catch {
    listed = null;
  }
  if (!Array.isArray(listed)) return fail('could not list the open pull requests.');

  // In order of number: the oldest pull request first, so that a newer one never jumps a queue it joined later.
  const candidates = [];
  const ordered = [...listed].sort((a, b) => a.number - b.number);
  log.record.considered = ordered.map((pr) => pr.number);
  for (const pr of ordered) {
    // UNKNOWN is GitHub not having computed the merge yet, for about a minute after main moves: the merge into
    // the candidate below is the queue's own test of it, so it decides. CONFLICTING is GitHub's answer.
    const problems = pullRequestProblems(pr.mergeable === 'UNKNOWN' ? { ...pr, mergeable: 'MERGEABLE' } : pr);
    if (problems.length) {
      leaveOut(log, stdout, pr, 'not-ready', problems.join(' '));
      continue;
    }
    const coverage = isCovered(pr.headRefOid);
    if (!coverage?.pass) {
      leaveOut(log, stdout, pr, 'review', `${String(coverage?.detail ?? 'its Codex review records could not be read').replace(/\.$/, '')}.`);
      continue;
    }
    if (coverage.lines?.length) {
      stdout(`PR ${pr.number}, commit by commit:`);
      for (const line of coverage.lines) stdout(`  ${line}`);
    }
    candidates.push(pr);
  }
  if (candidates.length === 0) {
    stdout('No pull request is ready to merge: nothing was built.');
    return 0;
  }

  // The candidate is built in a worktree under the git directory, which this command removes before it ends,
  // whatever happens in between: nothing it makes outlives the run.
  if (!common) return fail('could not find the git directory.');
  const place = path.join(path.resolve(cwd, common), 'js-harness', `merge-queue-${process.pid}-${Date.now()}`);
  fs.mkdirSync(path.dirname(place), { recursive: true });
  if (!gitIn(cwd, 'worktree', 'add', '--quiet', '--detach', place, main).ok) return fail('could not make the worktree of the candidate.');
  // main's own code, in a worktree beside the candidate's: the door runs main's check.mjs, never the candidate's
  // (odd/tasks/rule-hierarchy.md, "The merge door (T16e)"). Both worktrees are removed together, whatever happens.
  const mainPlace = `${place}-main`;
  try {
    if (!gitIn(cwd, 'worktree', 'add', '--quiet', '--detach', mainPlace, main).ok) return fail('could not make the worktree of main.');
    const checker = path.join(mainPlace, 'bin', 'check.mjs');
    const door = mainHasDoor(checker) ? checker : null;
    // No identity is written: a linked worktree has no configuration of its own, so `git config` here wrote the
    // shared one, and every session's commits were authored "js-harness merge-queue" until it was undone
    // (verifier, 2026-10-14). The merges take the identity the repository already has.
    const merged = [];
    for (const pr of candidates) {
      // The commit after each merge (`merge`): the candidate of the pull requests up to this one, which bisection tests.
      const step = mergeThroughDoor({ run, gitIn, place, door, pr, stdout });
      if (step.kind === 'merged') merged.push({ ...pr, merge: step.merge });
      else if (step.kind === 'broken') return fail(step.line);
      else if (step.kind === 'door') leaveOut(log, stdout, pr, 'door', `${step.line}.`);
      else if (step.conflicted.length) leaveOut(log, stdout, pr, 'conflict', `it conflicts with the candidate so far in ${step.conflicted.join(', ')}.`, { files: step.conflicted });
      else leaveOut(log, stdout, pr, 'merge', `it does not merge into the candidate so far: ${step.said}.`);
    }
    if (merged.length === 0) {
      stdout('No pull request merges into main: nothing was built.');
      return 0;
    }
    const list = merged.map((pr) => `PR ${pr.number} (${pr.headRefName})`).join(', ');
    stdout(`Candidate: main ${main.slice(0, 7)} with ${merged.length} pull request${merged.length === 1 ? '' : 's'} merged in order: ${list}.`);
    if (door === null) stdout('main\'s check.mjs has no merge door yet (odd/tasks/rule-hierarchy.md, T16e): no door ran');
    const documents = documentsAlone(gitIn, place, main, mainPlace);
    if (documents) stdout(DOCUMENTS_ALONE);
    if (args.dryRun) {
      stdout('Dry run: nothing was tested or pushed, and the candidate was removed.');
      return 0;
    }
    const tested = documents ? () => ({ ok: true, skipped: true }) : (suite ?? ((dir) => localSuite(run, dir, { env, say: stdout })));
    // Each run is a phase of the land's record, a bisection's halves too; one that did not run judged nothing,
    // and a candidate of documents alone has no run to record.
    const local = (dir) => {
      const ended = log.phase('suite');
      const result = tested(dir);
      if (!result.skipped) ended(result.notRun ? null : result.ok);
      return result;
    };
    // The relief file is found as `notify` finds it: the harness home, and the slug of the main checkout.
    const landed = (candidate, landedPrs) => recordLandings({
      gitIn, place, main, candidate, merged: landedPrs, now, stdout,
      home: harnessHomeOf(env),
      slug: projectSlug(mainCheckout((command, gitArgs, options) => run(command, gitArgs, { ...options, encoding: 'utf8' }), cwd)),
    });
    return await landCandidate({ run, gitIn, place, main, door, merged, suite: local, sleep, stdout, fail, landed, log });
  } finally {
    gitIn(cwd, 'worktree', 'remove', '--force', mainPlace);
    gitIn(cwd, 'worktree', 'remove', '--force', place);
  }
}
