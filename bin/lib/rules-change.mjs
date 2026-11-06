// The change of one rule, computed: the list a change gives, from the list in force, with no file system and no
// clock. `js-harness rules change` reads the list from origin/main, computes the change here, checks the result and
// writes it (odd/tasks/rule-hierarchy.md, "The one command that changes a rule (T16c)"). Every key a change does not
// name is kept as it is, so the command never drops what it was not asked to touch. The source of a change is checked
// here too, against transcripts the caller reads: a quotation is taken from the transcript, never from the change.
import { PASTED_CONTENT, quoteOf } from './sessions.mjs';

/** A change that cannot be made, with the reason a person reads. */
export class RuleChangeError extends Error {}

// The keys `set` may give, the form of a rule beside its body.
const SET_KEYS = new Set(['subject', 'owner', 'flag', 'alias', 'scope', 'review', 'differs']);
// The keys of the row `rules` (odd/tasks/rule-hierarchy.md, "The row `rules` (T16d)"): `patterns` and `failure` are a
// change of form, and `row` turns a rule to refuse or switches it back. While a rule refuses, the three are guarded.
const ROW_KEYS = new Set(['row', 'patterns', 'failure']);
// The keys that make a body, dropped when a rule is retired or changes body.
const BODY_KEYS = ['value', 'path', 'phrases'];
// The keys that go with a value only, dropped by a retirement because readRules refuses them on a retired rule.
const VALUE_ONLY = ['flag', 'alias'];

/** A value and its unit as a person reads them: `60 minutes`, or `gpt-fixture` with no unit. */
const amount = (value, unit) => (unit === undefined ? String(value) : `${value} ${unit}`);

/** A plain copy of a declaration, so that the list given is never changed. */
const copy = (rule) => JSON.parse(JSON.stringify(rule));

/** The one body a change names (`value`, `text` or `retire`), `null` for a change of form only. */
function bodyOf(change) {
  const bodies = [];
  if (Object.hasOwn(change, 'value')) bodies.push('value');
  if (Object.hasOwn(change, 'path') || Object.hasOwn(change, 'phrases')) bodies.push('text');
  if (Object.hasOwn(change, 'retire')) bodies.push('retire');
  if (bodies.length > 1) throw new RuleChangeError('a change has one body: a value, a path with phrases, or a retirement');
  return bodies.length === 1 ? bodies[0] : null;
}

/** The count of a rule's findings on origin/main when the caller gives none: not known, so no turn is made. */
const unknownCount = () => {
  throw new RuleChangeError("the count of the rule's findings on origin/main is not known, so it does not turn to refuse");
};

/** `rule` with the keys of the row `rules` that `set` gives, and what the change of its row was, or `null` for none.
 * `failures` holds the ids of the entries of docs/FAILURES.md; `countOf(rule)` counts the rule's findings in
 * origin/main's texts in force. A turn to refuse needs patterns, a failure and no finding there; while a rule refuses,
 * only the switch back changes the three keys, so a refusing rule is never disarmed by a change of form. */
function withRowKeys(rule, set, { today, failures, countOf }) {
  const named = [...ROW_KEYS].filter((key) => Object.hasOwn(set, key));
  if (named.length === 0) return null;
  const refusing = rule.row?.refuses !== undefined;
  const row = set.row;
  if (refusing && (named.some((key) => key !== 'row') || typeof row?.reports !== 'string')) {
    throw new RuleChangeError(`"${rule.id}" refuses since ${rule.row.refuses}: its patterns, failure and row change only by the switch back, set.row { "reports": <reason>, "since": "${today}" }`);
  }
  if (Object.hasOwn(set, 'failure') && set.failure !== null && !failures.has(set.failure)) {
    throw new RuleChangeError(`the failure "${set.failure}" names no entry of docs/FAILURES.md`);
  }
  for (const key of ['patterns', 'failure']) {
    if (!Object.hasOwn(set, key)) continue;
    if (set[key] === null) delete rule[key];
    else rule[key] = set[key];
  }
  if (!Object.hasOwn(set, 'row')) return null;
  if (row === null) {
    if (rule.row === undefined) throw new RuleChangeError(`"${rule.id}" has no row to remove`);
    delete rule.row;
    return 'row removed';
  }
  if (row !== null && typeof row === 'object' && Object.hasOwn(row, 'refuses')) {
    if (row.refuses !== today || Object.keys(row).length !== 1) throw new RuleChangeError(`a rule turns to refuse today: set.row { "refuses": "${today}" }`);
    if (!Array.isArray(rule.patterns) || rule.patterns.length === 0) throw new RuleChangeError(`"${rule.id}" has no patterns: a rule refuses only what its patterns find`);
    if (typeof rule.failure !== 'string') throw new RuleChangeError(`"${rule.id}" has no failure: a rule that refuses names the entry of docs/FAILURES.md it guards against`);
    const count = countOf(rule);
    if (count > 0) {
      throw new RuleChangeError(`"${rule.id}" has ${count} ${count === 1 ? 'finding' : 'findings'} in origin/main's texts in force: it turns to refuse once marks have replaced them and the count there is zero`);
    }
    rule.row = { refuses: today };
    return 'turned to refuse';
  }
  if (row !== null && typeof row === 'object' && Object.hasOwn(row, 'reports')) {
    if (!refusing) throw new RuleChangeError(`"${rule.id}" does not refuse: a rule switches back to report only from refuses`);
    if (typeof row.reports !== 'string' || row.reports.trim() === '' || row.since !== today || Object.keys(row).length !== 2) {
      throw new RuleChangeError(`the switch back gives its reason and today: set.row { "reports": <reason>, "since": "${today}" }`);
    }
    rule.row = { reports: row.reports, since: today };
    return `switched back to report (${row.reports}), a sighting of failure ${rule.failure}`;
  }
  throw new RuleChangeError('set.row is { "refuses": <today> }, { "reports": <reason>, "since": <today> } or null');
}

/** `rule` with the keys of `set` applied: a key given `null` is removed. Refuses a key `set` does not take. The keys
 * of the row `rules` are `withRowKeys`'s, applied before. */
function withSet(rule, set) {
  for (const [key, value] of Object.entries(set)) {
    if (ROW_KEYS.has(key)) continue;
    if (key === 'sensor') throw new RuleChangeError('"sensor" belongs to a project\'s list, docs/rules.json, which is edited by hand');
    if (!SET_KEYS.has(key)) throw new RuleChangeError(`"${key}" is not set by hand: the change writes it, or it is a body`);
    if (value === null) delete rule[key];
    else rule[key] = value;
  }
  return rule;
}

/** The value in force of `rule` moved into its earlier values, newest first, until `today`. */
function keepInWas(rule, today) {
  if (!Object.hasOwn(rule, 'value')) return;
  rule.was = [{ value: rule.value, until: today }, ...(rule.was ?? [])];
}

/** A new value on a live rule: the old one into `was`, or a rule in prose taking its first value. */
function newValue(rule, change, today) {
  if (Object.hasOwn(rule, 'value')) {
    if (change.unit !== undefined && change.unit !== rule.unit) {
      throw new RuleChangeError(`the unit of "${rule.id}" is ${rule.unit ?? 'none'}: its earlier values are read in it, so a new unit is a new id`);
    }
    if (change.value === rule.value) throw new RuleChangeError(`"${rule.id}" is already ${amount(rule.value, rule.unit)}`);
    const what = `${amount(rule.value, rule.unit)} to ${amount(change.value, rule.unit)}`;
    keepInWas(rule, today);
    rule.value = change.value;
    return what;
  }
  if (typeof change.value === 'number' && change.unit === undefined) {
    throw new RuleChangeError(`a number needs its unit: "${rule.id}" has none yet`);
  }
  delete rule.path;
  delete rule.phrases;
  rule.value = change.value;
  if (change.unit !== undefined) rule.unit = change.unit;
  return `prose to ${amount(change.value, change.unit)}`;
}

/** A new rule, from the change alone. Its keys go in the order of the file when it is written. */
function newRule(id, change, body, today, context) {
  const set = change.set ?? {};
  if (Object.hasOwn(set, 'row')) throw new RuleChangeError(`a new rule starts with no row: "${id}" turns to refuse by a change of its own, once its patterns find nothing on origin/main`);
  if (set.subject === undefined || set.owner === undefined) {
    throw new RuleChangeError(`no rule "${id}" is declared: a new rule gives subject and owner in "set"`);
  }
  if (body === null || body === 'retire') throw new RuleChangeError(`a new rule "${id}" needs a body: a value, or a path with phrases`);
  const rule = withSet({ id }, set);
  withRowKeys(rule, set, context);
  rule.since = today;
  if (body === 'value') {
    if (typeof change.value === 'number' && change.unit === undefined) throw new RuleChangeError('a number needs its unit');
    rule.value = change.value;
    if (change.unit !== undefined) rule.unit = change.unit;
  } else {
    rule.path = change.path;
    rule.phrases = change.phrases;
  }
  return rule;
}

/**
 * The list that `change` to the rule `id` gives from `list`, with a short account of it for the relief line:
 * `{ list, rule, what }`. `today` is the day written as YYYY-MM-DD; `failures` holds the ids of the entries of
 * docs/FAILURES.md, and `countOf(rule)` counts the rule's findings in origin/main's texts in force. It throws a RuleChangeError for a change that
 * cannot be made; whether the new list is readable and holds is the check's to say, on the result.
 */
export function changedList(list, id, change, { today, failures = new Set(), countOf = unknownCount }) {
  const context = { today, failures, countOf };
  const body = bodyOf(change);
  if (body === null && change.set === undefined) throw new RuleChangeError('the change names nothing: give a body or "set"');
  const at = list.findIndex((rule) => rule.id === id);

  if (at === -1) {
    const rule = newRule(id, change, body, today, context);
    return { list: [...list.map(copy), rule].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)), rule, what: 'new' };
  }
  const rule = copy(list[at]);
  if (Object.hasOwn(rule, 'retired')) {
    if (change.set?.subject !== undefined && change.set?.owner !== undefined) {
      throw new RuleChangeError(`"${id}" was retired on ${rule.retired}: an id is never reused, so a new rule takes a new id`);
    }
    throw new RuleChangeError(`"${id}" is retired since ${rule.retired}: a retired rule does not change`);
  }
  // A new rule gives its subject and its owner; given both, an id in force is taken for a new rule and refused.
  if (change.set?.subject !== undefined && change.set?.owner !== undefined) {
    throw new RuleChangeError(`"${id}" is in use: a new rule takes a new id, and a rule in force changes its subject and its owner in two changes`);
  }

  let what = 'form';
  if (body === 'value') {
    what = newValue(rule, change, today);
    rule.since = today;
  } else if (body === 'text') {
    if (Object.hasOwn(rule, 'value')) {
      throw new RuleChangeError(`"${id}" has a value: it becomes prose only by a retirement and a new id`);
    }
    rule.path = change.path;
    rule.phrases = change.phrases;
    rule.since = today;
    what = `text of ${change.path}`;
  } else if (body === 'retire') {
    const successors = change.retire?.successors ?? [];
    keepInWas(rule, today);
    for (const key of [...BODY_KEYS, ...VALUE_ONLY]) delete rule[key];
    const holdsNumber = (rule.was ?? []).some((item) => typeof item.value === 'number');
    if (!holdsNumber) delete rule.unit;
    rule.retired = today;
    rule.successors = successors;
    what = `retired, successors ${successors.length === 0 ? 'none' : successors.join(', ')}`;
  }
  if (change.set !== undefined) {
    const turned = withRowKeys(rule, change.set, context);
    withSet(rule, change.set);
    if (turned !== null) what = what === 'form' ? turned : `${what}; ${turned}`;
  }

  const changed = list.map(copy);
  changed[at] = rule;
  return { list: changed, rule, what };
}

// ---- the source -------------------------------------------------------------------------------------------

/** `text` with every run of white space made one space, and trimmed: how a quotation is compared. */
const squash = (text) => text.replace(/\s+/g, ' ').trim();

/** The day of the time `at` (an ISO time) by this machine's clock, YYYY-MM-DD. */
function localDay(at) {
  const day = new Date(at);
  const two = (n) => String(n).padStart(2, '0');
  return `${day.getFullYear()}-${two(day.getMonth() + 1)}-${two(day.getDate())}`;
}

/** One quotation of his, as the sources file stores it, read from line `line` of the transcript of `session`. The
 * double review's skip takes his words through it too (bin/double-review.mjs). */
export function quotationOf({ session, line, excerpt }, transcriptOf) {
  const text = transcriptOf(session);
  if (text === null) throw new RuleChangeError(`no transcript "${session}" in the project's sessions folder`);
  const quote = quoteOf(text, line);
  if (!quote.person) throw new RuleChangeError(`line ${line} of ${session} is not his: ${quote.what}`);
  if (quote.answered !== undefined && quote.answered.answers.some((answer) => answer.how === 'tapped')) {
    throw new RuleChangeError(`line ${line} of ${session} is a tapped answer: the option's text was written by a session, not typed by him`);
  }
  if (quote.pastedOnly) throw new RuleChangeError(`line ${line} of ${session} is only a paste: nothing in it was typed by him`);
  const typed = squash(quote.text.replace(PASTED_CONTENT, ' '));
  if (typed === '') throw new RuleChangeError(`line ${line} of ${session} holds nothing he typed`);
  if (quote.at === null || quote.at === undefined) throw new RuleChangeError(`line ${line} of ${session} holds no time, so its day is not known`);
  let stored = typed;
  if (excerpt !== undefined) {
    stored = squash(String(excerpt));
    if (stored === '' || !typed.includes(stored)) throw new RuleChangeError(`the excerpt "${stored}" is not in what he typed at line ${line} of ${session}`);
  }
  return { quote: stored, date: localDay(quote.at), session, line };
}

/** A text given and not blank, or a refusal naming `what` it is. */
function given(value, what) {
  if (typeof value !== 'string' || value.trim() === '') throw new RuleChangeError(`a source of his words needs ${what}`);
  return value;
}

/**
 * The source of a change as `docs/rule-sources.json` stores it, checked: his words read from their transcripts, or a
 * design path that is a file of the repository. `owner` is his when the rule is his before or after the change;
 * `form` is true for a change of the rule's form alone, which a design may source even on a rule of his;
 * `transcriptOf(session)` gives a transcript's text or `null`; `exists(path)` says whether a path is a file inside the
 * repository. It throws a RuleChangeError at the first fault.
 */
export function sourceOf(source, { owner, form = false, today, transcriptOf, exists }) {
  if (source?.kind === 'design') {
    if (owner === 'sebastian' && !form) throw new RuleChangeError('a rule of his changes only with his words, not a design, unless the change is of its form alone');
    if (typeof source.path !== 'string' || !exists(source.path)) throw new RuleChangeError(`the design ${source?.path} is not a file of the repository`);
    return { kind: 'design', path: source.path };
  }
  if (source?.kind !== 'words') throw new RuleChangeError('the source is words or design');
  if (!Array.isArray(source.quotes) || source.quotes.length === 0) throw new RuleChangeError('a source of his words needs at least one quotation');
  const quotes = source.quotes.map((quote) => quotationOf(quote, transcriptOf));
  return {
    kind: 'words',
    quotes,
    reading: given(source.reading, 'its reading'),
    accepted: given(source.accepted, 'where he accepted the reading ("accepted")'),
    checked: { date: today, by: 'command' },
  };
}
