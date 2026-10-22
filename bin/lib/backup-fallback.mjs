// When Engram fails (odd/tasks/recent-memory.md, D7): which project a session is in, whether Engram still holds it, and
// the notice that sends the session to the project's readable fallback. Pure functions: `backup --session-start` reads
// the files and runs `engram stats`, then asks these.
import { SHRINK_LIMIT } from './backup.mjs';

/** How long the session-start check waits for `engram stats` (the hook's own limit is 5 seconds). */
export const STATS_TIMEOUT_MS = 3000;

const norm = (dir) => String(dir).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const under = (dir, root) => dir === root || dir.startsWith(`${root}/`);
const lastPart = (text) => String(text).replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop();

/** The Engram project of a session, resolved in Engram's order where it can be read without Engram: `ENGRAM_PROJECT`;
 * `.engram/config.json`'s `project_name` in `cwd` or `main` (`config(dir)` returns it parsed, or null); the project whose
 * sessions ran in the folder holding `cwd` or `main` (`recent[].directories`, the longest match); `origin`'s repository
 * name; the main checkout's folder. Lower case, as Engram names projects. */
export function projectOf({ env, cwd, main, config, origin, recent }) {
  const named = (project, source) => ({ project: String(project).trim().toLowerCase(), source });
  if (env?.ENGRAM_PROJECT?.trim()) return named(env.ENGRAM_PROJECT, 'ENGRAM_PROJECT');
  for (const dir of [cwd, main]) {
    const name = config(dir)?.project_name;
    if (typeof name === 'string' && name.trim()) return named(name, '.engram/config.json');
  }
  let best = null;
  for (const entry of recent ?? []) {
    for (const dir of entry.directories ?? []) {
      const root = norm(dir);
      if (!root || ![cwd, main].some((here) => under(norm(here), root))) continue;
      if (!best || root.length > best.length) best = { length: root.length, project: entry.project };
    }
  }
  if (best) return named(best.project, 'directory');
  if (origin) return named(lastPart(origin).replace(/^.*:/, '').replace(/\.git$/i, ''), 'git remote');
  return named(lastPart(main ?? cwd), 'folder');
}

/** What an `engram stats --project <p>` run says: `ok` with its observations, `unknown` for a project Engram does not
 * hold, `timeout`, or `failed` with the reason. Takes spawnSync's result, or `defaultRun`'s, which folds the error into
 * stderr and leaves the status null. */
export function readStats(result) {
  const folded = result?.status === null ? /spawnSync \S+ (E[A-Z]+)/.exec(result?.stderr ?? '')?.[1] : undefined;
  const error = result?.error ?? (folded ? { code: folded } : null);
  if (error?.code === 'ETIMEDOUT') return { state: 'timeout' };
  if (error) return { state: 'failed', reason: `engram could not be run (${error.code ?? error.message})` };
  const text = `${result?.stdout ?? ''}\n${result?.stderr ?? ''}`;
  if (/unknown project/i.test(text)) return { state: 'unknown' };
  const observations = /^\s*Observations:\s+(\d+)/m.exec(result?.stdout ?? '')?.[1];
  if (result?.status === 0 && observations !== undefined) return { state: 'ok', observations: Number(observations) };
  return { state: 'failed', reason: (result?.stderr || result?.stdout || `exit ${result?.status}`).trim().split('\n')[0] };
}

const count = (n) => n.toLocaleString('en-US');

/** The notice for a session whose Engram does not hold its project (D7), or null while Engram holds at least nine
 * tenths of what the last backup held of it: Engram's own start registers a session, so the check is observations.
 * `entry` is the manifest's `recent` line of the project; with the clone gone the file is read from `repo` on GitHub. */
export function fallbackNotice({ entry, stats, clone, cloneExists, repo }) {
  const { project, observations: baseline } = entry;
  if (stats.state === 'ok' && stats.observations >= baseline * (1 - SHRINK_LIMIT)) return null;
  const reason = {
    unknown: `Engram has no memory of ${project}`,
    ok: `Engram holds ${count(stats.observations ?? 0)} of the ${count(baseline)} observations of ${project} the last backup held`,
    timeout: `Engram did not answer within ${STATS_TIMEOUT_MS / 1000} seconds`,
    failed: `Engram failed: ${stats.reason}`,
  }[stats.state];
  const sep = String(clone).includes('\\') ? '\\' : '/';
  const file = `${clone}${sep}${entry.file.split('/').join(sep)}`;
  const read = cloneExists
    ? `Read ${file}, lines 1-${entry.head} first (the state and the index of its ${entry.entries} entries), then the entries you need by the line the index gives.`
    : `The local backup is gone: read it from the private repository with \`gh api -H "Accept: application/vnd.github.raw" repos/${repo}/contents/${entry.file}\`, the first ${entry.head} lines first.`;
  const from = cloneExists ? clone : `https://github.com/${repo}.git`;
  return [
    `js-harness: ${reason} (memory fallback, odd/tasks/recent-memory.md).`,
    'The Engram protocol shown at this start is not working for this project. Until Engram is back, the readable fallback is the memory:',
    read,
    `To bring Engram back: \`js-harness backup restore --from "${from}" --merge\` (it adds only what Engram lacks); never \`js-harness backup run --allow-shrink\` before that, which would replace the good copy with the wiped memory.`,
    'Say so to the user before work that depends on past decisions.',
  ].join('\n');
}
