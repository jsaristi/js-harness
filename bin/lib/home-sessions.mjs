// The sessions of a project that are off the home its rules declare, for `js-harness rules applied`
// (odd/tasks/one-model-home.md, spec 6). On 2026-11-10 the user changed model and effort twice in a day, and nothing
// said which sessions still ran on the old ones nor what would put each right: a desktop session is judged by what the
// app's record of it holds (his menu), a background one by its last reply beside what its start asked, and each gets
// the act that corrects it, since no session changes its own. This module is the judgment alone: it reads no file and
// prints nothing, and ./home-sessions-read.mjs hands it the records.
import { heldOfRole, offHome, sameClaudeModel } from './model-home.mjs';

/** `{ model, effort }` as a line says it, with the advisor where `advisor` is a key of it. */
const said = ({ model, effort, ...more }) => `${model ?? 'no model'} at ${effort ?? 'no level'}${Object.hasOwn(more, 'advisor') ? ` with the advisor ${more.advisor}` : ''}`;

/** The advisor of a background session's last reply against the home's `advisor` (odd/tasks/advisor-home.md, spec 6):
 * `{ off, unknown }`, `off` null when it is the home's, `'none'` when the reply names its own model (the host repeats
 * the model where no advisor was asked) and the id it names otherwise; `unknown` why it cannot be told, where it
 * cannot: no reply read, a reply with no `advisorModel`, or a reply on the home's advisor itself, which names it
 * whether one was asked or not. */
function advisorOf(replied, advisor) {
  if (replied === null || replied === undefined) return { off: null, unknown: 'no reply of it was read' };
  if (typeof replied.advisor !== 'string') return { off: null, unknown: 'its last reply holds no advisorModel' };
  if (sameClaudeModel(replied.model, advisor)) return { off: null, unknown: 'its last reply ran on the home\'s advisor itself, which a reply names whether one was asked or not' };
  if (replied.advisor === replied.model || sameClaudeModel(replied.advisor, replied.model)) return { off: 'none', unknown: null };
  return { off: sameClaudeModel(replied.advisor, advisor) ? null : replied.advisor, unknown: null };
}

/** True when `home` (`{ model, effort, lead, advisor }`, each a value or null) holds something a session can be off. */
export const homeInForce = (home) => home !== null && typeof home === 'object' && [home.model, home.effort, home.lead, home.lenses, home.advisor].some((value) => typeof value === 'string');

/** The act that puts the background job `job` on the home: a resume, which waits for a job at work to end. */
const resumeOf = (job) => `a resume${job.working === true ? ' once its job is no longer at work, which a resume refuses until then:' : ','} js-harness sessions start --resume ${job.id}`;

/** The sessions off `home`, as `{ rows, archived, removedOff, on }`.
 *
 * `desktop` is the app's records of the project's sessions, each `{ id, title, model, effort, archived }`; `background`
 * the jobs `sessions start` recorded, each `{ id, title, asked, replied, state, working, removed }`: `asked` and `replied` are
 * `{ model, effort }`, what its start named (null where it named none) and what its last reply ran on (`replied` is
 * null when no reply was read), `state` what `claude agents` says of its job, as words, and `working` whether that job is at work. `isLead(title)` says whether a
 * title is a lead's, which is held to the lead's level where the home gives one.
 *
 * A row is `{ kind, id, title, held, off, corrects }` with what the session holds: a desktop row its `holds`, a
 * background row its `asked`, `replied` and `state`. A background session is judged by its last reply, and
 * by what its start asked only where no reply was read. `corrects` is the act that puts it on the home: `his menu`
 * for a lead in the app, since only the user changes a lead's own; `the lead's session tools` for another desktop
 * session; a resume for a background one, which takes the home's, once its job is no longer at work where it is, since
 * `sessions start --resume` refuses a conversation a job works; none for a job the harness removed, which is in no
 * row: `removedOff` counts those off the home.
 *
 * An archived desktop session is in no row: nothing corrects one while it is archived, and this machine held 124 of
 * them on 2026-11-11. `archived` counts them by what they hold, `[{ holds, count }]`, the most first. `on` counts the
 * sessions on the home, `{ desktop, background }`, archived ones left out. */
export function sessionsOffHome(home, { desktop = [], background = [], isLead = () => false, isSenior = () => false } = {}) {
  // A senior's title holds it to the senior's model and level, with no advisor (odd/tasks/senior-orchestrator.md).
  const heldOf = (title) => {
    const { model, effort } = heldOfRole(home, { lead: isLead(title), senior: isSenior(title) });
    return { model, effort };
  };
  const rows = [];
  const archived = new Map();
  const on = { desktop: 0, background: 0 };
  let removedOff = 0;
  for (const record of desktop) {
    const held = heldOf(record.title);
    const holds = { model: record.model ?? null, effort: record.effort ?? null };
    const off = offHome(holds, held);
    if (record.archived === true) {
      if (off !== null) archived.set(said(holds), (archived.get(said(holds)) ?? 0) + 1);
    } else if (off === null) on.desktop += 1;
    else rows.push({ kind: 'desktop', id: record.id ?? null, title: record.title ?? null, holds, held, off, corrects: isLead(record.title) ? 'his menu' : 'the lead\'s session tools' });
  }
  // A background session is held to the home's advisor too, where the home declares one; a desktop session is not,
  // since the app's record does not say which advisor it runs with.
  const advised = typeof home.advisor === 'string';
  const unknownAdvisor = [];
  for (const job of background) {
    const held = advised && heldOfRole(home, { senior: isSenior(job.title) }).advisor !== null ? { ...heldOf(job.title), advisor: home.advisor } : heldOf(job.title);
    const found = offHome(job.replied ?? job.asked, held);
    const advisor = advised ? advisorOf(job.replied, home.advisor) : { off: null, unknown: null };
    const off = found === null && advisor.off === null ? null : { ...(found ?? { model: null, effort: null }), ...(advised && { advisor: advisor.off }) };
    if (job.removed === true) {
      if (off !== null) removedOff += 1;
    } else if (off === null && advisor.unknown !== null) unknownAdvisor.push({ id: job.id, title: job.title ?? null, why: advisor.unknown });
    else if (off === null) on.background += 1;
    else rows.push({ kind: 'background', id: job.id, title: job.title ?? null, asked: job.asked, replied: job.replied ?? null, state: job.state ?? null, held, off, ...(advised && { advisorUnknown: advisor.unknown }), corrects: resumeOf(job) });
  }
  return { rows, archived: [...archived].map(([holds, count]) => ({ holds, count })).sort((one, other) => other.count - one.count), removedOff, on, unknownAdvisor };
}

/** What a background row says of its job: what its start asked, where a start that named none says so; its last
 * reply; and its job's state, or that the harness removed it. */
function backgroundSays(row) {
  const named = [row.asked?.model ?? null, row.asked?.effort ?? null];
  const asked = named.every((value) => value === null) ? 'its start named no model and no level' : `its start asked for ${said(row.asked)}`;
  // Where the row is held to an advisor, the reply says which it ran with: none, another, or one not known and why.
  const withAdvisor = !Object.hasOwn(row.held, 'advisor') || row.replied === null ? ''
    : row.advisorUnknown ? ` with an advisor not known (${row.advisorUnknown})`
      : row.off.advisor === 'none' ? ' with no advisor' : ` with the advisor ${row.off.advisor ?? row.held.advisor}`;
  const replied = row.replied === null ? 'no reply of it was read' : `its last reply ran on ${said({ model: row.replied.model, effort: row.replied.effort })}${withAdvisor}`;
  return `${replied}; ${asked}; its job: ${row.state ?? 'not read'}`;
}

/** The lines of the block `rules applied` prints for `result` (`sessionsOffHome`'s), after an empty line. `unread`
 * lists what could not be read, as words, each on a line of its own: a source that failed is never "none". */
export function offHomeLines(result, home, { unread = [] } = {}) {
  // The reviewers' level, where the home declares it, is said apart from the lead's (odd/tasks/lead-effort-split.md).
  const lenses = typeof home.lenses === 'string' ? `, and the lenses and the double review's Claude reader to ${home.lenses}` : '';
  const lead = typeof home.lead === 'string' ? `${lenses === '' ? ', and' : ','} the lead to ${home.lead}${lenses}` : lenses;
  const advisor = typeof home.advisor === 'string' ? `; a background session to the advisor ${home.advisor}` : '';
  const lines = ['', `Sessions off the home: a session is held to ${said({ model: home.model, effort: home.effort })}${lead}${advisor}`];
  for (const row of result.rows) {
    const name = `${JSON.stringify(row.title ?? '(no title)')}${row.kind === 'background' ? ` (${row.id})` : ''}`;
    const holds = row.kind === 'desktop' ? `its menu holds ${said(row.holds)}` : backgroundSays(row);
    lines.push(`  ${row.kind}  ${name}  ${holds}; held to ${said(row.held)}; corrected by ${row.corrects}`);
  }
  if (result.rows.length === 0) lines.push('  none that is open or runs');
  const count = result.archived.reduce((sum, item) => sum + item.count, 0);
  if (count > 0) {
    const by = result.archived.map((item) => `${item.count} at ${item.holds}`).join(', ');
    lines.push(`  ${count} archived desktop ${count === 1 ? 'session is' : 'sessions are'} off it too (${by}): nothing corrects one while it is archived; he can unarchive it, and it is then listed`);
  }
  if (result.removedOff > 0) {
    lines.push(`  ${result.removedOff} background ${result.removedOff === 1 ? 'job' : 'jobs'} the harness removed ran off it too: nothing corrects a job that is gone`);
  }
  lines.push(`  on the home: ${result.on.desktop} desktop, not archived, and ${result.on.background} background`);
  for (const job of result.unknownAdvisor ?? []) lines.push(`  not read: the advisor of ${JSON.stringify(job.title ?? '(no title)')} (${job.id}): ${job.why}, so it is not counted on the home`);
  for (const why of unread) lines.push(`  not read: ${why}`);
  lines.push('  The app\'s record does not say whether a session that is not archived is running. Nothing was written.');
  return lines;
}
