// The change of one rule, computed: the list a change gives, from the list in force, with no file system and no
// clock. `js-harness rules change` reads the list from origin/main, computes the change here, checks the result and
// writes it (odd/tasks/rule-hierarchy.md, "The one command that changes a rule (T16c)"). Every key a change does not
// name is kept as it is, so the command never drops what it was not asked to touch.

/** A change that cannot be made, with the reason a person reads. */
export class RuleChangeError extends Error {}

// The keys `set` may give, the form of a rule beside its body.
const SET_KEYS = new Set(['subject', 'owner', 'flag', 'alias', 'scope', 'review', 'differs']);
// The keys a later letter builds: named now so that the change's shape does not move under them.
const LATER_KEYS = new Set(['row', 'patterns', 'failure']);
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

/** `rule` with the keys of `set` applied: a key given `null` is removed. Refuses a key `set` does not take. */
function withSet(rule, set) {
  for (const [key, value] of Object.entries(set)) {
    if (LATER_KEYS.has(key)) throw new RuleChangeError(`"${key}" is set by a later letter (T16d), not built yet`);
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
function newRule(id, change, body, today) {
  const set = change.set ?? {};
  if (set.subject === undefined || set.owner === undefined) {
    throw new RuleChangeError(`no rule "${id}" is declared: a new rule gives subject and owner in "set"`);
  }
  if (body === null || body === 'retire') throw new RuleChangeError(`a new rule "${id}" needs a body: a value, or a path with phrases`);
  const rule = withSet({ id }, set);
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
 * `{ list, rule, what }`. `today` is the day written as YYYY-MM-DD. It throws a RuleChangeError for a change that
 * cannot be made; whether the new list is readable and holds is the check's to say, on the result.
 */
export function changedList(list, id, change, { today }) {
  const body = bodyOf(change);
  if (body === null && change.set === undefined) throw new RuleChangeError('the change names nothing: give a body or "set"');
  const at = list.findIndex((rule) => rule.id === id);

  if (at === -1) {
    const rule = newRule(id, change, body, today);
    return { list: [...list.map(copy), rule].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)), rule, what: 'new' };
  }
  const rule = copy(list[at]);
  if (Object.hasOwn(rule, 'retired')) {
    if (change.set?.subject !== undefined && change.set?.owner !== undefined) {
      throw new RuleChangeError(`"${id}" was retired on ${rule.retired}: an id is never reused, so a new rule takes a new id`);
    }
    throw new RuleChangeError(`"${id}" is retired since ${rule.retired}: a retired rule does not change`);
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
  if (change.set !== undefined) withSet(rule, change.set);

  const changed = list.map(copy);
  changed[at] = rule;
  return { list: changed, rule, what };
}
