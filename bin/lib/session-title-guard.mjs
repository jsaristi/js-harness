// The title of a session started with `start_session`, checked by the guard's `PreToolUse` hook
// (odd/tasks/session-title.md). A session's title carries its role: the board, the roster, `notify --to <n>` and the
// openings read the number from it. On 2026-10-19 three sessions the orchestrator started got free titles, so they had
// no number, and one later called itself "JH 7", a number already used. Only `start_session` loads this file, so the
// session board's module it reads the title shape from costs nothing on the other calls the guard checks.

import { roleOfTitle } from './sessions.mjs';
import { ruleHere } from './rules.mjs';

/** Why the `start_session` call whose input is `toolInput` is refused, or null. Where the rule `session-title` is
 * declared (`projectData`, the text of the project's rules file), a call that carries a `title` is refused when that
 * title is not a work session's `<code> <n> · <purpose>`; an offer is refused too, since the title it shows becomes the
 * session's. A call with no title (a proposal started as proposed) passes. `next` gives the project's next free number
 * (`nextSessionNumber` of ./channel.mjs) and is called only to word a refusal, so a good title reads no record. */
export function sessionTitleRefusal(toolInput, projectData, next) {
  if (!Object.hasOwn(toolInput ?? {}, 'title')) return null;
  const rule = ruleHere('session-title', undefined, projectData);
  if (!Object.hasOwn(rule, 'value')) return null;
  const title = toolInput.title;
  if (roleOfTitle(title)?.role === 'work') return null;
  const { code, number, unavailable = [] } = next();
  const shown = typeof title === 'string' ? JSON.stringify(title) : 'with no text';
  const why = code === null
    ? 'no numbered session is in this project\'s channel or openings'
    : `${number} is one past the highest number in this project's channel and openings`;
  const blind = unavailable.length > 0 ? `; it could not read ${unavailable.join(' and ')}, so check it with js-harness sessions --next-number` : '';
  return `js-harness guard: start_session titles the session ${shown}, not ${rule.value} (rule session-title). `
    + `Title it "${code ?? '<code>'} ${number} · <purpose>": ${why}${blind === '' ? ' (js-harness sessions --next-number).' : `${blind}.`}`;
}
