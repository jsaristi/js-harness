// The readable fallback of Engram (odd/tasks/recent-memory.md): one Markdown file per project, built from the backup's
// export, that a session reads when Engram is down or empty. It lives only in the private backup, because it holds the
// memories themselves. Pure functions: `backup run` writes what `buildRecent` returns, and `verify` and `ready` compare
// the files with it, so a file equal to it is current with its export.
import { createHash } from 'node:crypto';

/** The layout of the files; a file of another format is rebuilt by the next run, never called wrong (D8). */
export const RECENT_FORMAT = 1;
/** The observation types a file keeps (D2): what was decided, built, fixed or learned. Passive captures, session
 * summaries (the state, D3) and untyped notes are out. */
export const IMPORTANT_TYPES = new Set(['decision', 'architecture', 'bugfix', 'discovery', 'pattern', 'config', 'preference', 'feedback', 'reference', 'learning']);
/** How many entries a project file holds (S3). */
export const RECENT_LIMIT = 100;
/** How many of them decisions and architecture may take before the other types (D4). */
export const DECISION_SLOTS = 70;
/** How many session summaries the state section prints (D3). */
export const STATE_SUMMARIES = 3;

const WEIGHTED = new Set(['decision', 'architecture']);
const timeOf = (o) => String(o.updated_at ?? o.created_at ?? '');
const newestFirst = (a, b) => timeOf(b).localeCompare(timeOf(a)) || (b.id ?? 0) - (a.id ?? 0);
const dayOf = (o) => timeOf(o).slice(0, 10);
const oneLine = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

/** Each project's file in the clone (D1): the name in lower case with every character outside `[a-z0-9_-]` a `-`, so
 * no name reaches another folder; a Windows reserved name gains `-project`; names two projects would share each gain
 * the first 8 hex digits of their project's sha256. A `Map` of project to clone-relative path. */
export function recentFiles(projects) {
  const base = (project) => {
    const name = String(project).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    return RESERVED.test(name) ? `${name}-project` : name;
  };
  const taken = new Map();
  for (const project of projects) taken.set(base(project), (taken.get(base(project)) ?? 0) + 1);
  const hash = (project) => createHash('sha256').update(String(project)).digest('hex').slice(0, 8);
  return new Map(projects.map((p) => [p, `recent/${base(p)}${taken.get(base(p)) > 1 ? `-${hash(p)}` : ''}.md`]));
}

/** What a project's file holds (D3, D4): `entries`, at most `RECENT_LIMIT` important observations by weight, newest
 * first; `state`, the newest session summaries; `important`, how many important observations were candidates. */
export function selectRecent({ observations, relations, project }) {
  const bySync = new Map(observations.map((o) => [o.sync_id, o]));
  // A judged `supersedes` names its newer observation as the source. A target revised after the relation (Engram
  // updates in place by topic_key) is a new text the relation never judged, so it stays.
  const superseded = new Set(
    (relations ?? [])
      .filter((r) => r.relation === 'supersedes' && r.judgment_status !== 'pending' && bySync.has(r.source_id) && bySync.has(r.target_id))
      .filter((r) => String(r.updated_at ?? r.created_at ?? '') >= timeOf(bySync.get(r.target_id)))
      .map((r) => r.target_id),
  );
  const own = observations.filter((o) => o.project === project && !o.deleted_at);
  const state = own.filter((o) => o.type === 'session_summary').sort(newestFirst).slice(0, STATE_SUMMARIES);
  const seenTopics = new Set();
  const candidates = [];
  for (const o of own.filter((x) => IMPORTANT_TYPES.has(x.type) && !superseded.has(x.sync_id)).sort(newestFirst)) {
    if (o.topic_key && seenTopics.has(o.topic_key)) continue;
    if (o.topic_key) seenTopics.add(o.topic_key);
    candidates.push(o);
  }
  const pinned = candidates.filter((o) => o.pinned);
  const weighted = candidates.filter((o) => !o.pinned && WEIGHTED.has(o.type));
  const others = candidates.filter((o) => !o.pinned && !WEIGHTED.has(o.type));
  const room = Math.max(0, RECENT_LIMIT - pinned.length);
  // Each kind takes its share; what one leaves unused goes to the other.
  const weightedShare = Math.min(weighted.length, Math.max(DECISION_SLOTS, room - others.length), room);
  const othersShare = Math.min(others.length, room - weightedShare);
  const entries = [...pinned.slice(0, RECENT_LIMIT), ...weighted.slice(0, weightedShare), ...others.slice(0, othersShare)].sort(newestFirst);
  return { entries, state, important: candidates.length };
}

/** The sync_ids each observation has an unjudged conflict with (D4): Engram's pending relations, either side. */
function contestedBy(relations) {
  const map = new Map();
  const add = (a, b) => map.set(a, [...(map.get(a) ?? []), b]);
  for (const r of relations ?? []) {
    if (r.relation !== 'pending' && r.judgment_status !== 'pending') continue;
    add(r.source_id, r.target_id);
    add(r.target_id, r.source_id);
  }
  return map;
}

/** The meta line of an entry: day, type, topic_key, personal, pinned, its pending conflicts, and its sync_id. */
function metaOf(o, contested) {
  const conflicts = (contested.get(o.sync_id) ?? []).map((other) => `contested by ${other}`);
  return [dayOf(o), o.type, o.topic_key, o.scope === 'personal' ? 'personal' : null, o.pinned ? 'pinned' : null, ...conflicts, o.sync_id].filter(Boolean).join(' · ');
}

// One array item per line, the content's own lines too, so the index can count lines.
const block = (o, contested) => [`### ${oneLine(o.title)}`, '', metaOf(o, contested), '', ...String(o.content ?? '').replace(/\r\n?/g, '\n').trimEnd().split('\n'), ''];

/** A project's file and the number of lines of its head (the how-to, the state and the index, D2), which a session
 * reads in one go; the index gives the line of each entry. */
function renderProject(project, { entries, state, important }, contested) {
  const marked = entries.filter((o) => contested.has(o.sync_id)).length;
  const intro = [
    `# ${project}: recent memory`,
    '',
    `format: ${RECENT_FORMAT}`,
    '',
    'The readable fallback of Engram for this project, rebuilt by `js-harness backup run` from engram/export.json in',
    'the private backup. Use it when Engram is down, or holds no or few memories of this project:',
    '1. Read this head (the state and the index), then open the entries you need by their line.',
    '2. Bring Engram back: `js-harness backup restore --from <this backup> --merge` (it adds only what Engram lacks).',
    '   Never `backup run --allow-shrink` after a wipe: it would replace this copy with the wiped memory.',
    '3. Never edit this file: a memory corrected in Engram is corrected here at the next backup.',
    '',
    `It keeps ${entries.length} of ${important} important observations: pinned ones, then up to ${DECISION_SLOTS} decisions or`,
    'architecture, then the newest of the rest; superseded and deleted ones are left out, and an entry Engram holds an',
    `unjudged conflict on is marked "contested" (${marked} here). Newest: ${entries[0] ? dayOf(entries[0]) : 'none'}.`,
    '',
    '## State',
    '',
  ];
  const stateLines = state.length ? state.flatMap((s) => block(s, contested)) : ['No session summary.', ''];
  const bodies = entries.map((o) => block(o, contested));
  const index = (lineOf) => ['## Index', '', ...entries.map((o, i) => `${i + 1}. ${dayOf(o)} ${o.type}: ${oneLine(o.title)} (line ${lineOf[i]})`), ''];
  // The index has one line per entry whatever its numbers, so the head's length is known before them.
  const head = intro.length + stateLines.length + index(entries.map(() => 0)).length;
  const lineOf = [];
  let line = head + 3; // `## Entries`, a blank line, then the first heading
  for (const body of bodies) {
    lineOf.push(line);
    line += body.length;
  }
  const lines = [...intro, ...stateLines, ...index(lineOf), '## Entries', '', ...bodies.flat()];
  return { text: `${lines.join('\n').trimEnd()}\n`, head };
}

/** Every file of the fallback from an export: `files`, a `Map` of clone-relative path to text holding `RECENT.md`, the
 * index, and a file for each project with an important observation; `projects`, the manifest's `recent` (D5): each
 * project's file, entries, newest entry's day, head length, total observations (the hook's baseline) and the directories its sessions
 * ran in (the hook's map). */
export function buildRecent(data) {
  const observations = Array.isArray(data?.observations) ? data.observations : [];
  const relations = Array.isArray(data?.relations) ? data.relations : [];
  const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
  const contested = contestedBy(relations);
  const names = [...new Set(observations.map((o) => o.project).filter((p) => typeof p === 'string' && p !== ''))].sort();
  const selections = names.map((project) => ({ project, selection: selectRecent({ observations, relations, project }) })).filter((s) => s.selection.entries.length);
  const fileOf = recentFiles(selections.map((s) => s.project));
  const files = new Map();
  const projects = [];
  for (const { project, selection } of selections) {
    const file = fileOf.get(project);
    const { text, head } = renderProject(project, selection, contested);
    files.set(file, text);
    const directories = [...new Set(sessions.filter((s) => s.project === project && typeof s.directory === 'string' && s.directory).map((s) => s.directory))].sort();
    projects.push({ project, file, entries: selection.entries.length, newest: dayOf(selection.entries[0]), head, observations: observations.filter((o) => o.project === project && !o.deleted_at).length, directories });
  }
  const index = [
    '# Recent memory',
    '',
    `format: ${RECENT_FORMAT}`,
    '',
    'The readable fallback of Engram, one file per project, rebuilt by `js-harness backup run` from engram/export.json.',
    'When Engram is down or has lost a project\'s memories, a session reads that project\'s file; RESTORE.md brings',
    'Engram back.',
    '',
    ...projects.map((p) => `- ${p.project}: \`${p.file}\`, ${p.entries} entries, newest ${p.newest}`),
    '',
  ].join('\n');
  return { files: new Map([['RECENT.md', index], ...files]), projects };
}

/** The format a file says it was built by, or null. */
export function formatOf(text) {
  const found = /^format: (\d+)$/m.exec(String(text ?? '').split('\n').slice(0, 5).join('\n'));
  return found ? Number(found[1]) : null;
}

/** How the clone's files compare with what its export rebuilds (D8): `same`, files equal; `differ`, files of this
 * format that are not what the export rebuilds, or missing; `otherFormat`, files built by another format. Counts and
 * paths only, never contents. `read(file)` returns a file's text or null. */
export function compareRecent(data, read) {
  const { files } = buildRecent(data);
  const result = { same: 0, differ: [], otherFormat: [] };
  for (const [file, text] of files) {
    const held = read(file);
    if (held === text) result.same += 1;
    else if (held !== null && formatOf(held) !== RECENT_FORMAT) result.otherFormat.push(file);
    else result.differ.push(file);
  }
  return result;
}
