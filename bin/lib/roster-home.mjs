// What the roster says of a row against the home the project's rules declare (odd/tasks/one-model-home.md, spec 7):
// what the row holds and what it is held to (`rowHome`), the line under its mode line with its marks (`openerLine`),
// and the line the reading session gives the user when its own menu is off the home (`forHimLine`). On 2026-11-10 the
// board said `effort high` of the lead while its menu said more, and its one mark compared with a level written by
// hand. It is apart from ./sessions.mjs, which builds the rows and renders the board, because that module is at its
// ceiling (bin/conventions-structure.test.mjs). It reads no file and prints nothing: a row comes in, lines come out.
import { heldOfRole, menuLine, offHome } from './model-home.mjs';

const OPENED_WORDS = { his: 'opened by him', session: 'opened by a session', command: 'opened by a command', scheduled: 'opened by a scheduled task', unknown: 'opened unknown' };
const WHERE_WORDS = { sessions: 'in Sessions', routines: 'in Routines', archived: 'archived', 'not-in-app': 'not in the app', unknown: 'where unknown' };

/** What a row holds of the home and what it is held to, as `{ menu, held, off }`. `menu` is the app record's
 * `{ model, effort }` (what his menu holds), null with no `record`. `held` is the `{ model, effort }` of `home`
 * (`{ model, effort, lead }` as the rules give them, each null where the project declares none) the row is held to:
 * the lead's level for the orchestrator's row (`lead`) where the home gives one; null where no home is given or it
 * holds nothing, since a project that declares none of those rules marks nothing. `off` is what the menu, or with no
 * record the last reply (`replied`, the same shape), holds that `held` does not (`offHome`), with its `source`
 * (`menu` or `last reply`), else null. */
export function rowHome(home, { lead = false, senior = false, record = null, replied = null } = {}) {
  const inForce = home !== null && typeof home === 'object' && [home.model, home.effort, home.lead].some((value) => typeof value === 'string');
  const menu = record === null ? null : { model: record.model ?? null, effort: record.effort ?? null };
  const role = inForce ? heldOfRole(home, { lead, senior }) : null;
  const held = role === null ? null : { model: role.model, effort: role.effort };
  const differs = held === null ? null : offHome(menu ?? replied, held);
  return { menu, held, off: differs === null ? null : { source: menu === null ? 'last reply' : 'menu', ...differs } };
}

/** The line under a row's mode line: how its session was opened, where the app keeps it and its effort (both, where
 * his menu and the last reply disagree), then the marks: that it is not in his sidebar (in Routines, or not in the
 * app), that it has no app record where a home is in force, and what it holds that the home it is held to does not
 * (`rowHome`'s `off`), a higher level as well as a lower one. */
export function openerLine(row) {
  const held = row.held ?? null;
  const off = row.off ?? null;
  const marks = [];
  if (row.where === 'routines' || row.where === 'not-in-app') marks.push('NOT IN HIS SIDEBAR');
  if (held !== null && (row.menu ?? null) === null) marks.push('NO APP RECORD');
  if (off !== null && held !== null) {
    const differing = [off.model !== null && [`the model ${off.model}`, held.model], off.effort !== null && [`the level ${off.effort}`, held.effort]].filter(Boolean);
    marks.push(`OFF THE HOME: its ${off.source} holds ${differing.map(([has]) => has).join(' and ')}, the home ${differing.map(([, home]) => home).join(' and ')}`);
  }
  const menu = row.menu?.effort ?? null;
  const effort = row.effort === null ? 'effort unknown' : menu !== null && menu !== row.effort ? `effort ${menu} in its menu, ${row.effort} in its last reply` : `effort ${row.effort}`;
  return `    ${[OPENED_WORDS[row.opened] ?? OPENED_WORDS.unknown, WHERE_WORDS[row.where] ?? WHERE_WORDS.unknown, effort, ...marks].join('  ')}`;
}

/** The line for the session that reads the board when its own menu is off the home: a session cannot change its own
 * model or level, so it gives him this one (`menuLine`), with what its row is held to. None for another session's
 * row, for one on the home, or for one with no menu to pick in. */
export function forHimLine(row) {
  const off = row.off ?? null;
  if (row.self !== true || off === null || off.source !== 'menu') return [];
  if (typeof row.held?.model !== 'string' || typeof row.held?.effort !== 'string') return [];
  return [`    to give him: ${menuLine({ model: row.held.model, effort: row.held.effort })}`];
}
