// The pace of a project: how many tasks closed, reopened, were added and removed on each of the last days,
// read from the first-parent line of its default branch. `progress --pace` prints it (bin/progress.mjs); the
// design is S5 and S6 of odd/tasks/read-from-records.md. Each commit's changes to docs/ROADMAP.md and
// odd/tasks/*.md are compared before and after it, with the parsers `progress` counts with, so a task counts
// here exactly as it counts on the map. Zero dependencies, no I/O: git's output comes in, data goes out.
import { parseFeature, parseRoadmap } from './progress.mjs';
import { taskId } from './sessions.mjs';

/** How many days `--pace` reads when it is not told. */
export const PACE_DAYS = 14;

/** What git reads: the roadmap and every feature document, the same files `progress` reads. */
const PACE_PATHS = ['docs/ROADMAP.md', ':(glob)odd/tasks/*.md'];

// The first byte of a commit's line in the log, which no line of a diff can start with: its lines start with
// a space, `+`, `-`, `\`, `@` or a header word.
const COMMIT_MARK = '\u0001';

/** The arguments of the git process that names the branch read: origin/HEAD with what it points at, and main. */
export const PACE_REF_ARGS = ['for-each-ref', '--format=%(refname)%00%(symref)', 'refs/remotes/origin/HEAD', 'refs/heads/main'];

/** The branch `--pace` reads, from what `PACE_REF_ARGS` printed: what origin/HEAD points at (itself when it
 * points at nothing), else `main`, else `HEAD`. `{ ref, name }`, the full ref and how it is said. */
export function paceRef(stdout) {
  const refs = new Map();
  for (const line of stdout.split('\n')) {
    const [refname, symref = ''] = line.split('\0');
    if (refname) refs.set(refname, symref);
  }
  if (refs.has('refs/remotes/origin/HEAD')) {
    const ref = refs.get('refs/remotes/origin/HEAD') || 'refs/remotes/origin/HEAD';
    return { ref, name: ref.replace(/^refs\/remotes\//, '').replace(/^refs\/heads\//, '') };
  }
  if (refs.has('refs/heads/main')) return { ref: 'refs/heads/main', name: 'main' };
  return { ref: 'HEAD', name: 'HEAD' };
}

/** The arguments of the git process that reads the history: the first-parent line of `ref` since `since`, each
 * merge compared with its first parent so that a task that arrives checked in a merge is seen, renames as a
 * removal and an addition, and every change with all its file around it (`-U100000`), so that one process gives
 * each file's content before and after each commit. A file of more lines than that loses its far lines. The
 * prefixes and the quoting are fixed so that no config of the user's changes the paths read, and the paths are
 * relative to the folder git runs in, which is the one `progress` reads (`--cwd`). */
export function paceLogArgs({ ref, since }) {
  return [
    '-c', 'core.quotePath=false',
    'log', '--first-parent', '--diff-merges=first-parent', '--no-renames', '--no-ext-diff', '--no-textconv', '--no-color',
    '-p', '-U100000', '--src-prefix=a/', '--dst-prefix=b/', '--relative',
    `--since=${since}`, `--format=${COMMIT_MARK}%H %cI %P`,
    ref, '--', ...PACE_PATHS,
  ];
}

// A path as a diff header gives it: after its `a/` or `b/`, without the tab git ends it with when it holds a
// space, and unquoted when git quoted it.
function headerPath(rest) {
  let text = rest.replace(/\t$/, '');
  if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1).replace(/\\(["\\])/g, '$1');
  return text.slice(2);
}

/** The commits of what `paceLogArgs` printed, newest first: `{ id, date, parents, files }`, each file `{ path,
 * before, after }` with its content before and after the commit, `null` where the file did not exist. */
export function parsePaceLog(text) {
  const commits = [];
  let commit = null;
  let file = null;
  let inHunk = false;
  // A change git gives no `---`/`+++` header for has no content to compare: a mode alone, or an empty file
  // born or gone. It changes no task, and is left out.
  const finish = () => {
    if (file === null) return;
    if (file.path !== null) commit.files.push({ path: file.path, before: file.born ? null : file.before.join('\n'), after: file.gone ? null : file.after.join('\n') });
    file = null;
  };
  for (const raw of text.split('\n')) {
    if (raw.startsWith(COMMIT_MARK)) {
      if (commit !== null) finish();
      const [id, date, ...parents] = raw.slice(1).split(' ').filter(Boolean);
      commit = { id, date, parents, files: [] };
      commits.push(commit);
      continue;
    }
    if (commit === null) continue;
    if (raw.startsWith('diff --git ')) {
      finish();
      file = { path: null, before: [], after: [], born: false, gone: false };
      inHunk = false;
      continue;
    }
    if (file === null) continue;
    if (!inHunk) {
      if (raw === '--- /dev/null') file.born = true;
      else if (raw === '+++ /dev/null') file.gone = true;
      else if (raw.startsWith('--- ') || raw.startsWith('+++ ')) file.path = headerPath(raw.slice(4));
      else if (raw.startsWith('@@')) inHunk = true;
      continue;
    }
    const body = raw.slice(1);
    if (raw.startsWith(' ')) {
      file.before.push(body);
      file.after.push(body);
    } else if (raw.startsWith('-')) file.before.push(body);
    else if (raw.startsWith('+')) file.after.push(body);
    // `\ No newline at end of file`, another hunk's header and the blank line before the next commit are no content.
  }
  if (commit !== null) finish();
  return commits;
}

/** The steps of the file at `path` holding `markdown`, as `progress` counts them: the roadmap's checklist, or
 * every step of a feature document; none where the file did not exist. */
export function stepsOf(path, markdown) {
  if (markdown === null) return [];
  if (path === 'docs/ROADMAP.md') return parseRoadmap(markdown).phases.flatMap((phase) => phase.steps);
  return parseFeature(markdown, path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '')).steps;
}

// A task's leading ID, read by the grammar the session board and contract read (`taskId`, bin/lib/sessions.mjs).
// A bold ID (`**T5b**`) is read without its marks, as pace always read it; `null` for a task without one.
const BOLD_ID = /^\*\*(.+?)\*\*/;
const idOf = (text) => taskId(text.replace(BOLD_ID, '$1'))?.toUpperCase() ?? null;

/** What changed between the steps of one file `before` and `after` a commit: `{ closed, reopened, added,
 * removed }`. A task is matched by its leading ID when both sides have one, in order, and otherwise by its exact
 * text; so a task without an ID that is reworded is removed and added. Closed is open before and checked now, or
 * new and checked; reopened is checked before and open now. */
export function compareSteps(before, after) {
  const counts = { closed: 0, reopened: 0, added: 0, removed: 0 };
  const left = before.map((one) => ({ ...one, id: idOf(one.text), matched: false }));
  const right = after.map((one) => ({ ...one, id: idOf(one.text) }));
  const pairs = [];
  const unmatched = [];
  for (const one of right) {
    const twin = one.id === null ? undefined : left.find((other) => !other.matched && other.id === one.id);
    if (twin === undefined) unmatched.push(one);
    else {
      twin.matched = true;
      pairs.push([twin, one]);
    }
  }
  for (const one of unmatched) {
    const twin = left.find((other) => !other.matched && other.text === one.text);
    if (twin === undefined) {
      counts.added += 1;
      if (one.done) counts.closed += 1;
    } else {
      twin.matched = true;
      pairs.push([twin, one]);
    }
  }
  for (const [was, now] of pairs) {
    if (!was.done && now.done) counts.closed += 1;
    else if (was.done && !now.done) counts.reopened += 1;
  }
  counts.removed = left.filter((one) => !one.matched).length;
  return counts;
}

const pad = (n) => String(n).padStart(2, '0');

/** The day of `date` by this machine's calendar, `YYYY-MM-DD`. */
export const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The midnight, by this machine's calendar, that starts the last `days` days up to `now`. */
export const windowStart = (now, days) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));

const KINDS = ['closed', 'reopened', 'added', 'removed'];
const zero = () => Object.fromEntries(KINDS.map((kind) => [kind, 0]));

/** The pace of `commits` (`parsePaceLog`) over the last `days` days up to `now`: `{ days, from, to, perDay,
 * total, meanPerDay }`. Each day is cut by the committer date in this machine's time zone; a day with no commit
 * is 0, and today is `partial`. A commit with no parent is the start of a history, shallow or not, and counts
 * nothing. The mean a day is to one decimal. */
export function paceOf({ commits, now, days }) {
  const start = windowStart(now, days);
  const keys = Array.from({ length: days }, (_, at) => dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + at)));
  const perDay = new Map(keys.map((key) => [key, zero()]));
  for (const commit of commits) {
    if (commit.parents.length === 0) continue;
    const day = perDay.get(dayKey(new Date(commit.date)));
    if (day === undefined) continue;
    for (const file of commit.files) {
      const counts = compareSteps(stepsOf(file.path, file.before), stepsOf(file.path, file.after));
      for (const kind of KINDS) day[kind] += counts[kind];
    }
  }
  const today = dayKey(now);
  const total = zero();
  for (const counts of perDay.values()) for (const kind of KINDS) total[kind] += counts[kind];
  return {
    days,
    from: keys[0],
    to: keys.at(-1),
    perDay: keys.map((key) => ({ date: key, ...perDay.get(key), partial: key === today })),
    total,
    meanPerDay: Object.fromEntries(KINDS.map((kind) => [kind, Math.round((total[kind] / days) * 10) / 10])),
  };
}

const countsSaid = (counts) => KINDS.map((kind) => `${kind} ${counts[kind]}`).join('  ');

/** The pace as `progress --pace` prints it: the branch read, a line a day, the totals and the mean a day. */
export function paceLines({ branch, days, perDay, total, meanPerDay }) {
  const label = (text) => text.padEnd(12);
  return [
    `Pace of ${branch}, its first-parent line, by committer day over the last ${days === 1 ? 'day' : `${days} days`}:`,
    ...perDay.map((day) => `  ${day.date}  ${countsSaid(day)}${day.partial ? '  (today, so far)' : ''}`),
    `${label('Total')}${countsSaid(total)}`,
    `${label('A day')}${countsSaid(meanPerDay)}`,
  ];
}
