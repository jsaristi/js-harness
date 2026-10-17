// `js-harness merge-queue`: the ready pull requests merged into main as one candidate (odd/tasks/merge-queue.md).
//
// The candidate is origin/main with each ready pull request merged into it in order of number, built in a
// worktree of its own under the git directory and removed before the command ends. A pull request is ready
// when nothing of its own keeps it from merging (`pullRequestProblems`), every code commit of it has a Codex
// review record (`checkCodexReviews`), and it merges into the candidate so far with no conflict. `--dry-run`
// builds and prints the candidate; `--land` tests it and moves main to it (`landCandidate`).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { allDocuments, checkCodexReviews, codexReviewOffAt, discoverDocuments, DOCUMENT_DIFF } from './check.mjs';
import { GATE_NOT_RUN } from './gate.mjs';
import { appendRelief, reliefPath } from './lib/channel.mjs';
import { COMMIT_FORMAT, gitOut, loggedCommits, reviewCoverage } from './lib/codex-review-coverage.mjs';
import { evidenceRefusal, gentleAiEvidence, GENTLE_AI_CUTOVER } from './lib/gentle-ai-evidence.mjs';
import { pullRequestProblems } from './lib/pull-request.mjs';
import { declarationOf, rulesOfText } from './lib/rules-change-run.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';

export const USAGE = `Usage: js-harness merge-queue --dry-run | --land [--cwd <path>]

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
untested on this machine, or once CircleCI answered; a red here still spends that CircleCI run. When
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
3 main moved meanwhile (main not pushed), 5 the suite did not run (main not pushed), 1 anything else.
A landed pull request whose branch moved during the land is named after the landing: its new commits
are not in main, so it needs another run of the queue.
Each --land appends one JSON line to <git common dir>/js-harness/lands.jsonl: the pull requests it looked at, each
one left out with its reason, the time of each suite run, of CircleCI and of the push, what landed, and its exit.`;

const TIMEOUT_MS = 60_000;

/** One land's record (odd/tasks/land-unattended.md, Design 4, B2), filled while the land runs and written
 * once as it ends: what the throughput command measures lands by. `file` is set only by a land that is not a
 * dry run and found its git directory; `said` keeps the last line the land printed. */
function landLog({ now, session }) {
  const iso = (ms) => new Date(ms).toISOString();
  const record = { v: 1, startedAt: iso(now()), endedAt: null, session, main: null, considered: [], leftOut: [], phases: [], circleci: null, candidate: null, landed: [], exit: null, said: null };
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
  const args = { dryRun: false, land: false, cwd: process.cwd() };
  for (let at = 0; at < argv.length; at += 1) {
    if (argv[at] === '--dry-run') args.dryRun = true;
    else if (argv[at] === '--land') args.land = true;
    else if (argv[at] === '--cwd' && at + 1 < argv.length) args.cwd = argv[(at += 1)];
    else return null;
  }
  // One mode, named: a run that pushes main is never what a bare command does.
  return args.dryRun === args.land ? null : args;
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
  const done = answer(run, process.execPath, [bin, 'gate', '--wait', '90', '--', process.execPath, path.join(place, 'bin', 'check.mjs')], place, 120 * 60_000);
  // A ticket the gate did not claim (it ran nothing, or an older candidate's gate claims none) would hold one
  // of the two open slots for an hour: cancelled. One the gate claimed is gone, and its cancel exits 1 unsaid.
  if (issued) answer(run, process.execPath, [bin, 'gate', 'first', '--cancel', issued], place);
  if (done.status === GATE_NOT_RUN) return { ok: false, notRun: true, said: done.err.split('\n')[0] || 'the gate ran nothing' };
  if (done.status === null) return { ok: false, notRun: true, said: `the gate was stopped before it ended${done.err ? ` (${done.err.split('\n')[0]})` : ''}` };
  const last = failedRows(done.out);
  return { ok: done.ok, notRun: false, said: last.length ? last.join('; ') : 'the gate exited non-zero' };
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
 * the landed head holds counts: a line that ends "; declaration <hash>" when `declarations[id]` is that hash (the head's
 * declaration of the rule, `declarationOf`), and an older line that names none when it is stamped before `until` (ms),
 * the start of the second of the head's commit, since `rules change` stamps its line before the commit that holds it. */
export function landingLines(relief, { branch, ids, sha, declarations = {}, until = Infinity }) {
  const lines = String(relief).split('\n');
  const found = { lines: [], none: [] };
  for (const id of ids) {
    const proposal = `rule:${id} proposed on ${branch}, not landed`;
    const held = (line) => {
      const named = /; declaration ([0-9a-f]{12}|none)\s*$/.exec(line);
      return named === null ? stampOf(line) < until : named[1] === declarations[id];
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
    // What the landed head holds: each rule's declaration, and its commit time for a proposal line that names none.
    const committed = Number(gitIn(place, 'show', '-s', '--format=%ct', pr.headRefOid).out.trim());
    const shown = gitIn(place, 'show', `${pr.headRefOid}:${RULES_DATA}`);
    let declarations = null;
    try {
      declarations = shown.ok ? Object.fromEntries(ids.map((id) => [id, declarationOf(shown.out, id)])) : null;
    } catch {
      // A declaration that does not parse is one the head cannot be matched by.
    }
    if (!Number.isFinite(committed) || committed <= 0 || declarations === null) {
      stdout(`${said}, and what its head holds could not be read: no landing line is written for it.`);
      continue;
    }
    const { lines, none } = landingLines(relief, { branch: pr.headRefName, ids, sha: candidate.slice(0, 7), declarations, until: committed * 1000 });
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
  // is one CircleCI run spent on a candidate this machine turns red. Main still waits for both greens.
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
      let [low, high] = [1, merged.length];
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const failed = resetTo(merged[mid - 1].merge, `the merge of PR ${merged[mid - 1].number}`);
        if (failed !== null) return failed;
        const half = suite(place);
        if (half.notRun) return notRun(half);
        if (half.ok) low = mid + 1;
        else high = mid;
      }
      const culprit = merged[low - 1];
      leaveOut(log, stdout, culprit, 'red', `the candidate turns red on this machine when it is merged (${local.said}).`, { said: local.said });
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
      log.leave(merged[0], 'red', local.said);
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
      return 4;
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
  if (log.file) {
    // Written after the land ended, whatever its end: a record that cannot be written changes no exit.
    try {
      log.write(code);
    } catch (err) {
      stdout(`Could not write the land record to ${log.file} (${err.message}): the land's exit stands.`);
    }
  }
  return code;
}

async function queueRun(args, { run = spawnSync, covered = null, cutover = GENTLE_AI_CUTOVER, suite = null, env = process.env, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), stdout, stderr, log }) {
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
      home: env.JS_HARNESS_HOME || os.homedir(),
      slug: projectSlug(mainCheckout((command, gitArgs, options) => run(command, gitArgs, { ...options, encoding: 'utf8' }), cwd)),
    });
    return await landCandidate({ run, gitIn, place, main, door, merged, suite: local, sleep, stdout, fail, landed, log });
  } finally {
    gitIn(cwd, 'worktree', 'remove', '--force', mainPlace);
    gitIn(cwd, 'worktree', 'remove', '--force', place);
  }
}
