// The one module that knows which rules are the two homes of a model and an effort (odd/tasks/one-model-home.md,
// spec 2). Everything Claude the harness starts runs on the Claude home, `session-model` at `session-effort`; a Codex
// review runs on the Codex home, `review-model` at `review-effort`. On 2026-11-10 the user changed model and effort
// twice in a day, and each change was carried by hand through seven rules, three constants and an agent file; a
// launcher, a guard or a check that needs a model or an effort reads it here, so the next change is one place.
// It prints nothing and reads no file: a caller that holds a project's rules file passes its text in.
import { RULES } from './rules-data.mjs';
import { guardHeld, ruleHere, ruleOf } from './rules.mjs';

/** The ids of the rules of each home, which `js-harness rules switch` changes together. */
export const CLAUDE_HOME = Object.freeze({ model: 'session-model', effort: 'session-effort' });
export const CODEX_HOME = Object.freeze({ model: 'review-model', effort: 'review-effort' });

/** The effort levels a host takes, lowest first: the order that says one level is above another. */
export const EFFORTS = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);

/** Each level as the app's model menu names it. Medio, Alto and Extra alto are the user's own words for it
 * (2026-11-10); the two ends are assumed, and his to correct. */
export const MENU_LEVELS = Object.freeze({ low: 'Bajo', medium: 'Medio', high: 'Alto', xhigh: 'Extra alto', max: 'Máximo' });

/** The Claude home as `{ model, effort }`, the declared values whatever project the caller runs in: the harness's own
 * launches (a lens, the double review's reader) run on it everywhere. A guard, which holds a project to the home only
 * where that project declares the rules, reads `claudeHeld` instead. */
export function claudeHome(list = RULES) {
  return { model: ruleOf('session-model', list).value, effort: ruleOf('session-effort', list).value };
}

/** The Codex home as `{ model, effort }`. `bin/codex-review.mjs` keeps the read its launches use; this one is for
 * what shows or switches both homes. */
export function codexHome(list = RULES) {
  return { model: ruleOf('review-model', list).value, effort: ruleOf('review-effort', list).value };
}

/** What a guard holds of the Claude home in the project whose rules file has the text `projectData`, as
 * `{ model, effort }`, each `{ value, note }` as `guardHeld` gives it, or null where the project does not declare
 * the rules: a project that installs the harness is held to nothing. */
export function claudeHeld(projectData) {
  return {
    model: guardHeld('session-model', ruleHere('session-model', undefined, projectData)),
    effort: guardHeld('session-effort', ruleHere('session-effort', undefined, projectData)),
  };
}

const CLAUDE_ID = /^claude-([a-z]+)-(\d+(?:-\d{1,2})*)(?:-\d{8})?$/;

/** A model as a person reads it: `claude-fable-5-2` is "Fable 5.2", from its family and its version. An id of
 * another shape is given as it is, because a name made up for it would be a guess. */
export function displayName(id) {
  const match = CLAUDE_ID.exec(String(id));
  if (!match) return String(id);
  return `${match[1][0].toUpperCase()}${match[1].slice(1)} ${match[2].replace(/-/g, '.')}`;
}

/** `id` without what a record adds to it: a bracket (`[1m]`) and the date at its end. */
const bare = (id) => String(id).replace(/\[[^\]]*\]$/, '').replace(/-\d{8}$/, '');

/** True when the two ids name one model, a date at the end or a bracket aside. A short name is no id: it names
 * whatever the engine in use gives it (on 2026-11-10 `fable` gave claude-fable-5-1), so it is the same as nothing. */
export function sameModel(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a === '' || b === '') return false;
  return bare(a) === bare(b);
}

/** The line a session gives the user when its own model or effort is not the home's `{ model, effort }`: a session
 * cannot change its own, so he picks them in the menu. In Spanish, the language he reads, and modelled on the line he
 * acted on within two minutes on 2026-11-10. */
export function menuLine({ model, effort }) {
  return `En esta sesión, abre el selector de modelo que está junto a la caja donde escribes y elige ${displayName(model)} con esfuerzo ${MENU_LEVELS[effort] ?? effort}.`;
}
