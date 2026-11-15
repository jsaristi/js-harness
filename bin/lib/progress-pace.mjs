// The pace of a project: how many tasks closed, reopened, were added and removed on each of the last days,
// read from the first-parent line of its default branch. `progress --pace` prints it (bin/progress.mjs); the
// design is S5 and S6 of odd/tasks/read-from-records.md. Each commit's changes to docs/ROADMAP.md and
// odd/tasks/*.md are compared before and after it, with the parsers `progress` counts with, so a task counts
// here exactly as it counts on the map. `progress --baseline` compares the plan of a day with today's by the same
// matching (spec 10 of odd/tasks/audit-cement.md). Zero dependencies, no I/O: git's output comes in, data goes out.
import { parseFeature, parseRoadmap } from './progress.mjs';
import { taskId } from './sessions.mjs';

/** How many days `--pace` reads when it is not told. */
export const PACE_DAYS = 14;

/** The days of the week `progress --pace` says red or green: a week, the last whole days before today. */
export const WEEK_DAYS = 7;

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
  const { pairs, added, removed } = pairSteps(before, after);
  const counts = { closed: added.filter((one) => one.done).length, reopened: 0, added: added.length, removed: removed.length };
  for (const [was, now] of pairs) {
    if (!was.done && now.done) counts.closed += 1;
    else if (was.done && !now.done) counts.reopened += 1;
  }
  return counts;
}

// The steps of one file before and after, matched as `compareSteps` says: `{ pairs, added, removed }`, each pair
// `[before, after]`, `added` the steps after with no twin and `removed` those before with none.
function pairSteps(before, after) {
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
  const added = [];
  for (const one of unmatched) {
    const twin = left.find((other) => !other.matched && other.text === one.text);
    if (twin === undefined) added.push(one);
    else {
      twin.matched = true;
      pairs.push([twin, one]);
    }
  }
  return { pairs, added, removed: left.filter((one) => !one.matched) };
}

// --- `--baseline`: how much of the plan open on a day is done now, and how much the plan changed since (spec 10
// of odd/tasks/audit-cement.md) ---

/** The arguments of the git process that names the baseline: the last commit of `ref`'s first-parent line made
 * before `before`, an ISO time. */
export const baselineCommitArgs = ({ ref, before }) => ['rev-list', '-1', '--first-parent', `--before=${before}`, ref];

/** The arguments of the git process that names the empty tree, in the hash of the repository's own format. */
export const EMPTY_TREE_ARGS = ['hash-object', '-t', 'tree', '--stdin'];

/** The arguments of the git process that gives every plan file of `to` whole: its diff from the empty tree
 * `from`, with the prefixes, quoting and folder fixed as `paceLogArgs` fixes them. */
export function treeArgs({ from, to }) {
  return [
    '-c', 'core.quotePath=false',
    'diff', '--no-renames', '--no-ext-diff', '--no-textconv', '--no-color',
    '-U100000', '--src-prefix=a/', '--dst-prefix=b/', '--relative',
    from, to, '--', ...PACE_PATHS,
  ];
}

/** The plan files of what `treeArgs` printed: a map of each path to its content. */
export function parseTree(text) {
  const [tree] = parsePaceLog(`${COMMIT_MARK}tree\n${text}`);
  return new Map(tree.files.map((file) => [file.path, file.after ?? '']));
}

/** How the plan `after` (a map of path to content, `parseTree`) stands against the plan `before`: `{ openThen,
 * closed, stillOpen, leftOpen, added, addedClosed, stepsThen, stepsNow, openNow }`. A step is matched in its own
 * file as `compareSteps` matches it, so a step reworded without an ID, or in a file moved, left the plan open and
 * came back as added. `closed` counts the steps open then and checked now; `leftOpen` those open then that are in
 * the plan no more. */
export function baselineOf({ before, after }) {
  const counts = { openThen: 0, closed: 0, stillOpen: 0, leftOpen: 0, added: 0, addedClosed: 0, stepsThen: 0, stepsNow: 0, openNow: 0 };
  for (const path of new Set([...before.keys(), ...after.keys()])) {
    const then = stepsOf(path, before.get(path) ?? null);
    const now = stepsOf(path, after.get(path) ?? null);
    const { pairs, added, removed } = pairSteps(then, now);
    counts.stepsThen += then.length;
    counts.stepsNow += now.length;
    counts.openThen += openOf(then);
    counts.openNow += openOf(now);
    for (const [was, is] of pairs) {
      if (was.done) continue;
      if (is.done) counts.closed += 1;
      else counts.stillOpen += 1;
    }
    counts.leftOpen += openOf(removed);
    counts.added += added.length;
    counts.addedClosed += added.filter((one) => one.done).length;
  }
  return counts;
}

/** `part` of `whole` as a whole percent, or `—` when there is no whole to be part of. */
const percentOf = (part, whole) => (whole === 0 ? '—' : `${Math.round((part / whole) * 100)}%`);

/** The baseline as `progress --baseline` prints it: what of the plan open on `date` (at the commit `base`) is done
 * on `branch` now, and how much the plan changed since. */
export function baselineLines({ branch, date, base, openThen, closed, stillOpen, leftOpen, added, addedClosed, stepsThen, stepsNow, openNow }) {
  const label = (text) => text.padEnd(12);
  const grew = stepsNow - stepsThen;
  const moved = grew > 0 ? `grew by ${grew}` : grew < 0 ? `fell by ${-grew}` : 'did not grow';
  return [
    `Plan of ${branch} since ${date}, from ${base.slice(0, 8)} (its last commit before that day) to now:`,
    `${label('Open then')}${openThen} steps`,
    `${label('Done')}${closed} of them closed (${percentOf(closed, openThen)}), ${stillOpen} still open, ${leftOpen} left the plan open`,
    `${label('Added')}${added} steps since (${percentOf(added, stepsThen)} of the plan then), ${addedClosed} of them closed`,
    `${label('The plan')}${stepsThen} steps then, ${stepsNow} now: it ${moved}; open steps ${openThen} then, ${openNow} now`,
  ];
}

const pad = (n) => String(n).padStart(2, '0');

/** The day of `date` by this machine's calendar, `YYYY-MM-DD`. */
export const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The midnight, by this machine's calendar, that starts the last `days` days up to `now`. */
export const windowStart = (now, days) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));

const KINDS = ['closed', 'reopened', 'added', 'removed'];
const zero = () => Object.fromEntries(KINDS.map((kind) => [kind, 0]));

/** How many of `steps` are open. */
const openOf = (steps) => steps.filter((one) => !one.done).length;

/** The pace of `commits` (`parsePaceLog`) over the last `days` days up to `now`: `{ days, from, to, perDay,
 * total, meanPerDay, week }`. Each day is cut by the committer date in this machine's time zone; a day with no
 * commit is 0, and today is `partial`. A commit with no parent is the start of a history, shallow or not, and
 * counts nothing. The mean a day is to one decimal. `week` is the last `WEEK_DAYS` whole days, today left out so
 * that a morning's merges do not turn it, or `null` when the window holds fewer: its counts, how many open steps
 * it `grew` by, the open steps of each file after each commit less those before, so a step reworded or a document
 * moved or landed finished grows nothing, and `red` when that is more than none. */
export function paceOf({ commits, now, days }) {
  const start = windowStart(now, days);
  const keys = Array.from({ length: days }, (_, at) => dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + at)));
  const perDay = new Map(keys.map((key) => [key, zero()]));
  const grewOn = new Map(keys.map((key) => [key, 0]));
  for (const commit of commits) {
    if (commit.parents.length === 0) continue;
    const key = dayKey(new Date(commit.date));
    const day = perDay.get(key);
    if (day === undefined) continue;
    for (const file of commit.files) {
      const before = stepsOf(file.path, file.before);
      const after = stepsOf(file.path, file.after);
      const counts = compareSteps(before, after);
      for (const kind of KINDS) day[kind] += counts[kind];
      grewOn.set(key, grewOn.get(key) + openOf(after) - openOf(before));
    }
  }
  const today = dayKey(now);
  const total = zero();
  for (const counts of perDay.values()) for (const kind of KINDS) total[kind] += counts[kind];
  const whole = keys.filter((key) => key !== today).slice(-WEEK_DAYS);
  let week = null;
  if (whole.length === WEEK_DAYS) {
    const counts = zero();
    for (const key of whole) for (const kind of KINDS) counts[kind] += perDay.get(key)[kind];
    const grew = whole.reduce((sum, key) => sum + grewOn.get(key), 0);
    week = { from: whole[0], to: whole.at(-1), ...counts, grew, red: grew > 0 };
  }
  return {
    days,
    from: keys[0],
    to: keys.at(-1),
    perDay: keys.map((key) => ({ date: key, ...perDay.get(key), partial: key === today })),
    total,
    meanPerDay: Object.fromEntries(KINDS.map((kind) => [kind, Math.round((total[kind] / days) * 10) / 10])),
    week,
  };
}

const countsSaid = (counts) => KINDS.map((kind) => `${kind} ${counts[kind]}`).join('  ');

/** The week as its line says it: its counts, how its open steps moved, and red or green. */
function weekSaid(week) {
  const moved = week.grew > 0 ? `grew by ${week.grew}` : week.grew < 0 ? `fell by ${-week.grew}` : 'did not grow';
  const state = week.red ? 'red' : 'green';
  return `Last 7 days ${week.from} to ${week.to}: ${countsSaid(week)}; the open steps ${moved}: ${state}`;
}

/** The pace as `progress --pace` prints it: the branch read, a line a day, the totals, the mean a day and, when the
 * window holds a whole week, the week's line. */
export function paceLines({ branch, days, perDay, total, meanPerDay, week = null }) {
  const label = (text) => text.padEnd(12);
  return [
    `Pace of ${branch}, its first-parent line, by committer day over the last ${days === 1 ? 'day' : `${days} days`}:`,
    ...perDay.map((day) => `  ${day.date}  ${countsSaid(day)}${day.partial ? '  (today, so far)' : ''}`),
    `${label('Total')}${countsSaid(total)}`,
    `${label('A day')}${countsSaid(meanPerDay)}`,
    ...(week === null ? [] : [weekSaid(week)]),
  ];
}
