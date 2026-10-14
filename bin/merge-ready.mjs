// `js-harness merge-ready <pr>`: whether a pull request may be merged on its GitHub run, without merging it.
//
// It fetches origin, reads the pull request, the latest run of its head and the merge that run tested
// (bin/lib/merge-ready.mjs decides what those add up to), and prints why. It merges nothing, pushes
// nothing and reopens nothing: a fetch is the only thing it writes, under .git. Exit 0 ready, 3 stale
// (reopen for a fresh run, once refs/pull/N/merge is computed against main), 4 no run for the head or a
// run not finished or not green, 1 any other check failed or something could not be read.
import { spawnSync } from 'node:child_process';
import { FAILED, mergeReadiness, testedMerge } from './lib/merge-ready.mjs';

export const USAGE = `Usage: js-harness merge-ready <pr>

Says whether pull request <pr> may be merged on its GitHub run, and merges nothing. Ready means: the
pull request is open, not a draft, mergeable, based on main, with a gentle-ai line in its body; the
latest run of its head finished green; and the merge that run tested (its checkout log, "HEAD is now
at <m> Merge <head> into <base>") has today's origin/main as its base, or a base behind main only by
documents (docs/ and odd/tasks/, never an AGENTS.md) with the head merging cleanly into main.

Exit 0 ready, 3 stale (main moved by code since the tested base: close and reopen the pull request
for a fresh run once refs/pull/<pr>/merge has main as its first parent, which it prints), 4 no run
for the head, or a run not finished or not green, 1 any other check failed or could not be read.`;

/** The milliseconds one git or gh answer may take; the log of a run is given more. */
const ANSWER_TIMEOUT_MS = 30_000;
const LOG_TIMEOUT_MS = 120_000;

function answer(run, command, args, timeout = ANSWER_TIMEOUT_MS) {
  let result;
  try {
    result = run(command, args, { encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return { ok: false, out: '' };
  }
  return { ok: !result?.error && result?.status === 0, out: String(result?.stdout ?? '') };
}

const json = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export async function mergeReadyMain(argv = process.argv.slice(2), { run = spawnSync, stdout = console.log, stderr = console.error } = {}) {
  if (argv.includes('--help') || argv.includes('-h')) {
    stdout(USAGE);
    return 0;
  }
  if (argv.length !== 1 || !/^[1-9]\d*$/.test(argv[0])) {
    stderr(USAGE);
    return FAILED;
  }
  const number = Number(argv[0]);
  const fail = (line) => {
    stderr(`merge-ready: ${line}`);
    return FAILED;
  };

  if (!answer(run, 'git', ['fetch', '-q', 'origin']).ok) return fail('could not fetch origin.');
  const main = answer(run, 'git', ['rev-parse', 'origin/main']).out.trim();
  if (!main) return fail('could not read origin/main.');
  const pr = json(answer(run, 'gh', ['pr', 'view', String(number), '--json', 'number,state,isDraft,mergeable,baseRefName,body,headRefOid,headRefName']).out);
  if (!pr) return fail(`could not read PR ${number}.`);

  const facts = { pr, main, run: null, tested: null, baseIsAncestor: false, changedSinceBase: [], mergeTreeClean: false, pullMergeParent: null };
  const listed = json(answer(run, 'gh', ['run', 'list', '--branch', pr.headRefName, '--limit', '20', '--json', 'databaseId,headSha,createdAt,status,conclusion']).out);
  if (!Array.isArray(listed)) return fail(`could not list the runs of ${pr.headRefName}.`);
  const latest = listed.filter((one) => one.headSha === pr.headRefOid).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).at(-1);
  if (latest) facts.run = { id: latest.databaseId, status: latest.status, conclusion: latest.conclusion || null };

  if (facts.run?.status === 'completed' && facts.run.conclusion === 'success') {
    const log = answer(run, 'gh', ['run', 'view', String(facts.run.id), '--log'], LOG_TIMEOUT_MS);
    if (!log.ok) return fail(`could not read the log of run ${facts.run.id}.`);
    facts.tested = testedMerge(log.out);
    if (facts.tested && facts.tested.head === pr.headRefOid && facts.tested.base !== main) {
      const base = facts.tested.base;
      facts.baseIsAncestor = answer(run, 'git', ['merge-base', '--is-ancestor', base, main]).ok;
      if (facts.baseIsAncestor) {
        facts.changedSinceBase = answer(run, 'git', ['diff', '--name-only', base, main]).out.split('\n').map((path) => path.trim()).filter(Boolean);
        facts.mergeTreeClean = answer(run, 'git', ['merge-tree', '--write-tree', main, pr.headRefOid]).ok;
      }
      if (answer(run, 'git', ['fetch', '-q', 'origin', `refs/pull/${number}/merge`]).ok) {
        facts.pullMergeParent = answer(run, 'git', ['rev-parse', 'FETCH_HEAD^1']).out.trim() || null;
      }
    }
  }

  const { code, said } = mergeReadiness(facts);
  for (const line of said) (code === 0 ? stdout : stderr)(line);
  return code;
}
