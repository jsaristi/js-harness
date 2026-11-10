// The stack-update row of `doctor`: the version of each tool of the stack, and of the Claude CLI on PATH, against the
// versions last reviewed (the `stack` record of the doctor cache, bin/lib/cache.mjs). A tool that updated itself since
// is a gap until its review is recorded (`doctor --stack-reviewed`), so the session hook names it at the next start
// instead of a measurement finding it on the version it was not planned for (docs/FAILURES.md, cli-updated-itself:
// engram moved to 3.3.0 and the native updater replaced `claude` on PATH, each seen only when a run was about to start).
// The Claude Desktop app and its Code tab CLI have the host-update row (bin/lib/host-update.mjs). Nothing here throws.

/** A version as a tool prints it: digits first, so `hosted` and other words are no version. */
const VERSION = /^\d+(?:\.\d+)*(?:[-+][\w.-]+)?$/;

/** `{ id: version }` of the tools `rows` read as installed with a version, and the Claude CLI on PATH as `claude` when
 * its version was read. */
export function stackVersions(rows, claude) {
  const versions = {};
  if (claude) versions.claude = claude;
  for (const row of rows) {
    if (row.installed === 'ok' && VERSION.test(String(row.version ?? ''))) versions[row.id] = row.version;
  }
  return Object.fromEntries(Object.entries(versions).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** `{ row, record }`: the `stack-update` row for the versions read and the reviewed record (the cache's
 * `stack.reviewed`, or `null`), and the record to write, or `null`. The first reading is recorded as reviewed. After
 * that a tool read for the first time joins the record as it is, and a moved version is a gap that only
 * `--stack-reviewed` records. A tool no longer read is no change: uninstalling is not an update. */
export function stackUpdateRow(versions, reviewed, now = () => new Date()) {
  const row = { id: 'stack-update', version: null, installed: 'n/a', claude: 'n/a', codex: 'n/a', project: 'n/a', upToDate: 'n/a', fix: {} };
  const ids = Object.keys(versions);
  if (ids.length === 0) return { row, record: null };
  const read = { ...row, installed: 'ok', version: `${ids.length} tool${ids.length === 1 ? '' : 's'}` };
  if (!reviewed) return { row: read, record: { versions, at: now().toISOString() } };

  const before = reviewed.versions;
  const added = ids.filter((id) => !Object.hasOwn(before, id));
  const record = added.length > 0 ? { versions: { ...before, ...Object.fromEntries(added.map((id) => [id, versions[id]])) }, at: reviewed.at } : null;
  const moved = ids.filter((id) => Object.hasOwn(before, id) && before[id] !== versions[id]);
  if (moved.length === 0) return { row: read, record };
  const change = moved.map((id) => `${id} ${before[id]} → ${versions[id]}`).join(', ');
  return {
    row: {
      ...read,
      installed: 'stale',
      change,
      fix: {
        installed: [
          `${change} since the last review; review the update:`,
          'read the changelog of each tool between those versions',
          'check that the hooks and commands of the harness that run them still work',
          'say it to the user, and to whoever plans a measurement on the versions before',
          'then record the review: js-harness doctor --stack-reviewed',
        ],
      },
    },
    record,
  };
}

/** The first words of a review row whose record cannot be read (bin/lib/cache.mjs, `readReviewed`), here and in the
 * host-update row (./host-update.mjs). */
export const UNREADABLE_RECORD = 'the record of the versions last reviewed cannot be read (~/.js-harness/reviewed.json), so no version is taken as reviewed';

/** The `stack-update` row when the record of its review cannot be read: a gap that records nothing, so a torn record
 * never turns an update into a reviewed one (M10 of the Fable 5.2 audit); `--stack-reviewed` records the review. With
 * no version read it is the row `stackUpdateRow` gives. */
export function stackUnreadableRow(versions) {
  const { row } = stackUpdateRow(versions, null);
  if (row.installed !== 'ok') return row;
  const named = Object.entries(versions).map(([id, version]) => `${id} ${version}`).join(', ');
  return {
    ...row,
    installed: 'stale',
    unreadable: true,
    fix: {
      installed: [
        `${UNREADABLE_RECORD}; review the tools at the versions read now, ${named}:`,
        'read the changelog of each tool since the version the harness was last planned on',
        'check that the hooks and commands of the harness that run them still work',
        'say it to the user, and to whoever plans a measurement on the versions before',
        'then record the review: js-harness doctor --stack-reviewed',
      ],
    },
  };
}

/** What the hook's notice adds for this row: the tools updated since the last review, or that its record is unread. */
export function stackNotice(row) {
  if (row?.installed === 'stale' && row.unreadable) return 'the record of the stack review cannot be read';
  return row?.installed === 'stale' && row.change ? `${row.change} since the last review` : '';
}
