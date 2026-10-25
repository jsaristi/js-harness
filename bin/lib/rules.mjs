// The rules of this project as data: what each one says, with its value and unit or its prose and
// phrases, and what makes a list of them unreadable. This file reads a list and names each fault in
// it; it holds no fs and no process access, and every function takes plain data. It imports only
// createHash of node:crypto and RULES of ./rules-data.mjs, so no command can form a cycle.
import { createHash } from 'node:crypto';
import { RULES } from './rules-data.mjs';

/** The owners a rule can have: the person who decides it, or the project itself. */
export const OWNERS = ['sebastian', 'project'];

// Every key a declaration may hold. Any other key is refused by name.
const KEYS = new Set([
  'id', 'subject', 'owner', 'scope', 'since',
  'value', 'unit', 'flag', 'alias', 'was',
  'path', 'phrases',
  'retired', 'successors',
  'patterns', 'row', 'failure', 'differs', 'review',
  'sensor',
]);
// The keys only the harness's own list holds, each refused in a project's list with the reason a person reads
// (odd/tasks/project-rules.md, "What a project can declare").
const NOT_FOR_A_VALUE = 'a value needs a reader, and the project code cannot import the harness; write the rule in prose';
const NOT_FOR_A_PATTERN = 'a rule about the code names its sensor';
const HARNESS_ONLY = new Map([
  ['scope', 'the list is the project by where it is'],
  ['alias', 'only the harness speaks to a host'],
  ['flag', 'only a command of the harness parses one'],
  ['value', NOT_FOR_A_VALUE],
  ['unit', NOT_FOR_A_VALUE],
  ['was', NOT_FOR_A_VALUE],
  ['patterns', NOT_FOR_A_PATTERN],
  ['row', NOT_FOR_A_PATTERN],
]);
// Lower-case words joined by hyphens, each word starting with a letter, so no id is a number.
const ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const FLAG_PATTERN = /^--[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
// The short name a host takes where the id cannot be passed: one lower-case word of at most 32 characters.
const ALIAS_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
// The one scope a rule can have: it is in force only in the repository that declares it.
const REPOSITORY_SCOPE = 'repository';
const DIGIT = /\d/;

/** True for a plain object: not null, not an array, and not a text, a number or a list. */
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** True for a non-empty text. */
const isText = (value) => typeof value === 'string' && value.length > 0;

/** True for a real day written `YYYY-MM-DD`: `2026-02-30` has the shape and is no date. */
export function isDay(value) {
  const match = typeof value === 'string' ? DATE_PATTERN.exec(value) : null;
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** True for an id: a text in the form `ID_PATTERN` allows. */
const usableId = (id) => typeof id === 'string' && ID_PATTERN.test(id);

/** `value` as text for a message, without throwing on a value that has no text form. */
function show(value) {
  try {
    return String(value);
  } catch {
    return '(a value with no text form)';
  }
}

/** `text` with every run of white space read as one space and the ends trimmed, so a phrase is
 * measured by its words and not by the spaces around them. */
const squash = (text) => text.replace(/\s+/g, ' ').trim();

// What `{amount}` stands for in a pattern: any amount in any wording, so a pattern finds a restated value by its
// subject and still finds it after the value changes. A number with an optional unit word ("60 minutes", "3,600 s",
// "88%"), an hour or half of one, a model id ("gpt-6.1-sol", "claude-opus-5-5"), or an effort level ("high"). An
// effort word counts only as a word of its own: inside a mark (`rule:gate-max`), a flag (`--max`) or a call
// (`Math.max(`) it is no amount, or the mark that cures a finding would be one. A number, too, counts only as a
// number of its own: the digits inside an id ("S1"), a hash ("e5b7588", "3fa2b91") or a line number
// ("check.mjs:42") are none. So, on purpose, are a signed or dotted number ("-5", ".5 h"), the second half of a
// hyphen range ("30-60") and a compact duration ("1h30m"): no rule's value is written so, and taking a digit after
// a letter back would take the hashes back.
const OWN = String.raw`(?<![\w.:-])`;
const AMOUNT = String.raw`(?:${OWN}\d[\d,.]*(?:\s*(?:%|[a-z]+\b))?(?!\w)|(?:half )?an? (?:hour|minute|day)\b|[a-z]+(?:-[a-z0-9.]+)*-\d[\w.]*|${OWN}(?:low|medium|x?high|max)(?![\w(-]|\.\w))`;

/** The regular expression of `pattern`, its `{amount}` written out, tried case-insensitively on one line. */
export function patternOf(pattern) {
  return new RegExp(pattern.split('{amount}').join(AMOUNT), 'i');
}

/** True when `pattern` is a regular expression that `new RegExp` accepts, its `{amount}` written out. */
function compiles(pattern) {
  try {
    patternOf(pattern);
    return true;
  } catch {
    return false;
  }
}

/** True for a path of the repository: forward slashes, not absolute, and no `..` segment, so that no
 * rule can send its reader out of the project. */
function isPath(path) {
  return isText(path)
    && !path.startsWith('/')
    && !/^[A-Za-z]:/.test(path)
    && !path.includes('\\')
    && !path.split('/').includes('..');
}

/** True for one earlier value: exactly `{ value, until }`, a value that is a number or a text, and a
 * real day, so that a rule's history is always readable as dated values. */
function isEarlier(item) {
  return isObject(item)
    && Object.keys(item).sort().join(',') === 'until,value'
    && (Number.isFinite(item.value) || isText(item.value))
    && isDay(item.until);
}

/** True for a row: exactly `{ refuses: day }`, or exactly `{ reports: text, since: day }`. */
function isRow(row) {
  if (!isObject(row)) return false;
  const keys = Object.keys(row).sort().join(',');
  if (keys === 'refuses') return isDay(row.refuses);
  return keys === 'reports,since' && isText(row.reports) && isDay(row.since);
}

/** The faults of a rule's value body, in the order they are read: the value, the unit, the flag. */
function valueFaults({ value, unit, flag }) {
  const faults = [];
  if (!Number.isFinite(value) && !isText(value)) faults.push('the value is not a number or a text');
  else if (typeof value === 'number' && unit === undefined) faults.push('a number needs its unit');
  if (unit !== undefined && !isText(unit)) faults.push('the unit is not a text');
  if (flag !== undefined && !(typeof flag === 'string' && FLAG_PATTERN.test(flag))) faults.push('the flag is not written --name');
  return faults;
}

/** True when `was` is a list that holds at least one earlier value that is a number, whatever else it holds. */
const holdsNumber = (was) => Array.isArray(was) && was.some((item) => isObject(item) && typeof item.value === 'number');

/** The faults of a rule's text body: both its path and its phrases, and each phrase long enough to be
 * found only on purpose. A field that is missing is named once, by the missing message. */
function textFaults({ path, phrases }, minPhrase) {
  const faults = [];
  if (path === undefined || phrases === undefined) faults.push('a rule in prose needs its path and its phrases');
  if (path !== undefined && !isPath(path)) {
    faults.push('the path is not a path of the repository, written with forward slashes');
  }
  if (phrases !== undefined) {
    if (!Array.isArray(phrases) || phrases.length === 0 || !Array.from(phrases).every(isText)) {
      faults.push('the phrases are not a list of texts');
    } else {
      for (const phrase of Array.from(phrases)) {
        const short = squash(phrase);
        if (short.length < minPhrase) {
          faults.push(`the phrase "${short}" is shorter than ${minPhrase} characters: it could be found by accident`);
        }
      }
    }
  }
  return faults;
}

/** The faults of a retired rule's body: its day, and its successors, each one a rule of the list. Its unit is read
 * in `ruleFaults`, with the earlier values, because a retired rule keeps its unit only when those values are numbers. */
function retiredFaults({ id, retired, successors }, declared) {
  const faults = [];
  if (!isDay(retired)) faults.push('retired is not a day written YYYY-MM-DD');
  if (!Array.isArray(successors) || !Array.from(successors).every((item) => typeof item === 'string')) {
    faults.push('the successors are not a list of ids');
  } else {
    for (const successor of Array.from(successors)) {
      if (successor === id) faults.push('a rule is not its own successor');
      else if (!declared.has(successor)) faults.push(`the successor "${successor}" is declared nowhere`);
    }
  }
  return faults;
}

/** The faults of a rule's earlier values: each one dated, and the dates newest first. The order is
 * checked only when every item is readable, so one shape fault never hides behind a second. */
function wasFaults(was) {
  if (!Array.isArray(was) || !Array.from(was).every(isEarlier)) {
    return ['an earlier value is written { value, until: YYYY-MM-DD }'];
  }
  const items = Array.from(was);
  const faults = [];
  // A history is one kind of value throughout: a number with its unit, or a text, never both in one list.
  const numbers = items.some((item) => typeof item.value === 'number');
  const texts = items.some((item) => typeof item.value === 'string');
  if (numbers && texts) faults.push('the earlier values are all numbers or all texts');
  if (items.some((item, i) => i > 0 && item.until > items[i - 1].until)) faults.push('the earlier values are not newest first');
  return faults;
}

/** The faults of the optional keys, in the order they are read. Each one is checked only when present. */
function optionalFaults({ patterns, row, failure, differs, review }) {
  const faults = [];
  if (patterns !== undefined) {
    const items = Array.isArray(patterns) ? Array.from(patterns) : null;
    if (items === null || items.length === 0 || !items.every(isText)) {
      faults.push('the patterns are not a list of texts');
    } else {
      for (const pattern of items) {
        if (!compiles(pattern)) faults.push(`the pattern "${pattern}" is not a regular expression`);
        else if (!pattern.includes('{amount}')) faults.push(`the pattern "${pattern}" has no {amount}: it finds a value by its subject and any amount`);
        else if (patternOf(pattern).test('')) faults.push(`the pattern "${pattern}" matches an empty line`);
      }
    }
  }
  if (row !== undefined && !isRow(row)) {
    faults.push('the row is written { refuses: YYYY-MM-DD } or { reports: <reason>, since: YYYY-MM-DD }');
  }
  if (failure !== undefined && !usableId(failure)) faults.push('the failure is not an id of the register');
  if (differs !== undefined && !isText(differs)) faults.push('differs is not a text');
  if (review !== undefined && !isDay(review)) faults.push('review is not a day written YYYY-MM-DD');
  return faults;
}

/** The faults of one rule that is a plain object, in the order the file reads them. The id and the
 * order of ids are checked by `readRules`, which owns the whole list. */
function ruleFaults(rule, { minPhrase, declared, project }) {
  if (project) return projectRuleFaults(rule, { minPhrase, declared });
  const faults = [];
  for (const key of Object.keys(rule)) {
    if (!KEYS.has(key)) faults.push(`unknown key "${key}"`);
    else if (key === 'sensor') faults.push('a sensor body is for a project list');
  }
  if (!isText(rule.subject) || rule.subject.trim() === '') faults.push('the subject is missing');
  else if (DIGIT.test(rule.subject)) {
    faults.push('the subject holds a number: it is a label of what the rule is about, and the value is written once, in "value"');
  }
  if (rule.owner === undefined) faults.push('the owner is missing: it is sebastian or project');
  else if (!OWNERS.includes(rule.owner)) faults.push(`the owner is "${show(rule.owner)}": it is sebastian or project`);
  if (rule.scope !== undefined && rule.scope !== REPOSITORY_SCOPE) {
    faults.push(`the scope is "${show(rule.scope)}": it is repository, or it is absent`);
  }
  if (!isDay(rule.since)) faults.push('since is not a day written YYYY-MM-DD');

  const bodies = [];
  if (Object.hasOwn(rule, 'value')) bodies.push('value');
  if (Object.hasOwn(rule, 'path') || Object.hasOwn(rule, 'phrases')) bodies.push('text');
  if (Object.hasOwn(rule, 'retired')) bodies.push('retired');
  if (bodies.length === 0) faults.push('no body: a rule has a value, or a path with phrases, or is retired');
  else if (bodies.length > 1) faults.push('more than one body: a rule has a value, or a path with phrases, or is retired');
  const body = bodies.length === 1 ? bodies[0] : null;

  if (body === 'value') faults.push(...valueFaults(rule));
  if (body === 'text') faults.push(...textFaults(rule, minPhrase));
  if (body === 'retired') faults.push(...retiredFaults(rule, declared));
  // A retired rule whose earlier values are numbers keeps its unit, so that its history says minutes or seconds.
  if (body === 'retired' && holdsNumber(rule.was)) {
    if (!isText(rule.unit)) faults.push('a retired rule whose earlier values are numbers keeps its unit');
  } else if (rule.unit !== undefined && (body === 'text' || body === 'retired')) faults.push('a unit goes with a value');
  if (rule.flag !== undefined && body !== 'value') faults.push('a flag goes with a value');
  if (rule.alias !== undefined) {
    if (body === 'text' || body === 'retired') faults.push('an alias goes with a value');
    else if (!(typeof rule.alias === 'string' && ALIAS_PATTERN.test(rule.alias))) faults.push('the alias is one short lower-case word');
  }
  if (rule.successors !== undefined && (body === 'value' || body === 'text')) faults.push('successors go with a retired rule');
  if (rule.was !== undefined && body === 'text') faults.push('earlier values go with a value or a retired rule');
  if (rule.was !== undefined && (body === 'value' || body === 'retired')) faults.push(...wasFaults(rule.was));
  faults.push(...optionalFaults(rule));
  return faults;
}

/** The faults of one rule of a project's own list (`docs/rules.json`): the keys only the harness's list holds
 * are refused with their reason, the owner is the project's or absent, and the body is prose, a sensor that
 * enforces the rule, or a retirement. */
function projectRuleFaults(rule, { minPhrase, declared }) {
  const faults = [];
  for (const key of Object.keys(rule)) {
    if (HARNESS_ONLY.has(key)) faults.push(`${key} is not for a project list: ${HARNESS_ONLY.get(key)}`);
    else if (!KEYS.has(key)) faults.push(`unknown key "${key}"`);
  }
  if (!isText(rule.subject) || rule.subject.trim() === '') faults.push('the subject is missing');
  if (rule.owner !== undefined && rule.owner !== 'project') {
    faults.push(`the owner is "${show(rule.owner)}": in a project list the owner is project, or it is absent`);
  }
  if (!isDay(rule.since)) faults.push('since is not a day written YYYY-MM-DD');

  const bodies = [];
  if (Object.hasOwn(rule, 'path') || Object.hasOwn(rule, 'phrases')) bodies.push('text');
  if (Object.hasOwn(rule, 'sensor')) bodies.push('sensor');
  if (Object.hasOwn(rule, 'retired')) bodies.push('retired');
  const kinds = 'a rule of a project is in prose (a path with phrases), names its sensor, or is retired';
  if (bodies.length === 0) faults.push(`no body: ${kinds}`);
  else if (bodies.length > 1) faults.push(`more than one body: ${kinds}`);
  const body = bodies.length === 1 ? bodies[0] : null;

  if (body === 'text') faults.push(...textFaults(rule, minPhrase));
  if (body === 'sensor' && !isText(rule.sensor)) faults.push('the sensor is not the name of a sensor');
  if (body === 'retired') faults.push(...retiredFaults(rule, declared));
  if (rule.successors !== undefined && body !== 'retired') faults.push('successors go with a retired rule');
  const { failure, differs, review } = rule;
  faults.push(...optionalFaults({ failure, differs, review }));
  return faults;
}

/** The faults that make `list` unreadable, one line each, every fault of every rule in list order;
 * an empty result means the list is readable. It never throws, and it says every fault it finds,
 * because a list that is read one fault at a time takes one round per fault to repair. The shortest
 * phrase is itself a declared rule, read here when no other bound is given. */
export function readRules(list, { minPhrase, declared = RULES, project = false } = {}) {
  if (!Array.isArray(list)) return ['the rules are not a list'];
  const faults = [];
  // The shortest phrase, read from `declared` when no bound is given. When it cannot be read, that is the first
  // fault, and the bound is 0, so that no phrase is too short and the rest of the list is still read.
  let bound = minPhrase;
  if (bound === undefined) {
    try {
      bound = ruleValue('control-phrase-min', 'characters', declared);
    } catch (err) {
      faults.push(`the shortest phrase cannot be read: ${err.message}`);
      bound = 0;
    }
  }
  // Every id a rule declares, so that a successor is checked against the whole list, not only the rules before it.
  const ids = new Set();
  for (let index = 0; index < list.length; index += 1) {
    if (isObject(list[index]) && usableId(list[index].id)) ids.add(list[index].id);
  }

  const seen = new Set();
  let previous = null;
  for (let index = 0; index < list.length; index += 1) {
    const rule = list[index];
    if (!isObject(rule)) {
      faults.push(`rule at index ${index}: not an object`);
      previous = null;
      continue;
    }
    const { id } = rule;
    const usable = usableId(id);
    const who = usable ? `rule "${id}": ` : `rule at index ${index}: `;
    if (!usable) {
      faults.push(`${who}the id is missing or is not lower-case words joined by hyphens`);
    } else if (seen.has(id)) {
      faults.push(`${who}the id is declared twice`);
    } else {
      if (previous !== null && id <= previous) {
        faults.push(`${who}the list is not sorted by id: it comes after "${previous}"`);
      }
      seen.add(id);
    }
    for (const message of ruleFaults(rule, { minPhrase: bound, declared: ids, project })) faults.push(who + message);
    previous = usable ? id : null;
  }
  return faults;
}

/** The declaration of the live rule `id` in `list`, which every read goes through. It refuses a rule that is not
 * there and a retired rule, because each would give a wrong answer without a word. */
function liveRule(id, list) {
  const rule = list.find((item) => item.id === id);
  if (!rule) throw new Error(`no rule "${id}" is declared (bin/lib/rules-data.mjs)`);
  if (Object.hasOwn(rule, 'retired')) {
    const successors = rule.successors ?? [];
    if (successors.length === 0) {
      throw new Error(`rule "${id}" is retired since ${rule.retired}: nothing reads it any more`);
    }
    throw new Error(`rule "${id}" is retired since ${rule.retired}: read ${successors.join(', ')} instead`);
  }
  return rule;
}

/** Throws when `rule` cannot give its value in `unit`: a rule in prose has no value, and a value is read only in the
 * unit it is declared in, because a number without its unit is a wrong number without a word. */
function checkUnit(rule, id, unit) {
  if (!Object.hasOwn(rule, 'value')) throw new Error(`rule "${id}" is a rule in prose: it has no value to read`);
  if (rule.unit !== unit) {
    const declared = rule.unit === undefined ? 'no unit' : rule.unit;
    const asked = unit === undefined ? 'no unit' : unit;
    throw new Error(`rule "${id}" is in ${declared}, and it was read as ${asked}`);
  }
}

/** The value of the rule `id`, for the code that needs it. It refuses a rule that is not there, one
 * that is retired, one of this repository only (read it with `ruleHere`), one in prose, and a read in
 * another unit. It does not check the list: `readRules` does that. */
export function ruleValue(id, unit, list = RULES) {
  const rule = liveRule(id, list);
  if (rule.scope === REPOSITORY_SCOPE) throw new Error(`rule "${id}" is of this repository only: read it with ruleHere`);
  checkUnit(rule, id, unit);
  return rule.value;
}

/** The value of the rule `id` for code that ships, read where the project is known: `projectData` is the text
 * of the project's rules-data.mjs, or nothing. A rule with no scope gives `{ value }` whatever `projectData` is.
 * A rule of scope `repository` gives `{ value }` only when `projectData` is the list the running copy holds (line
 * endings aside). `{ off: 'elsewhere' }` means a project that does not declare the rules, one that installs the
 * harness. `{ off: 'behind' }` means a copy of the harness whose list is not the project's. It refuses as `ruleValue`
 * does for an unknown id, a retired rule, a rule in prose and another unit. It throws for a `projectData` of a rule of
 * scope `repository` that is neither a text nor nothing, because that is a caller's mistake and not a stale copy. */
export function ruleHere(id, unit, projectData, list = RULES) {
  const rule = liveRule(id, list);
  checkUnit(rule, id, unit);
  if (rule.scope === undefined) return { value: rule.value };
  if (projectData !== null && projectData !== undefined && typeof projectData !== 'string') {
    throw new Error(`rule "${id}": ruleHere takes the text of the project's rules file, or nothing`);
  }
  if (projectData === null || projectData === undefined) return { off: 'elsewhere' };
  if (typeof projectData === 'string' && lineFeeds(projectData) === lineFeeds(writeRules(list))) return { value: rule.value };
  return behindOf(rule, projectData);
}

/** What `ruleHere` says of the live scoped rule `rule` for a project whose rules file reads `projectData`, another text
 * than the running list: `{ off: 'behind' }`, and where that file is a list in the shape `writeRules` gives that declares
 * the rule live with the same scope, `held` (the running copy's value, which a guard holds there) and `same` (true when
 * the project declares the rule with the keys the hash names as the copy does). Every landed rule change makes the
 * installed copy differ, and a guard that passed every call then let three sessions open with free titles
 * (odd/tasks/behind-copy-guard.md, S1). */
function behindOf(rule, projectData) {
  const project = projectListOf(projectData);
  const declared = project === null ? undefined : project.find((item) => isObject(item) && item.id === rule.id);
  if (declared === undefined || Object.hasOwn(declared, 'retired') || declared.scope !== rule.scope) return { off: 'behind' };
  return { off: 'behind', held: rule.value, same: JSON.stringify(pick(declared, HASH_KEYS)) === JSON.stringify(pick(rule, HASH_KEYS)) };
}

/** The list a project's rules file `projectData` holds, read as JSON in the shape `writeRules` gives and never imported,
 * or null when it is no text or not that shape. Its entries are not held to `readRules`: a reader keeps to what it needs. */
export function projectListOf(projectData) {
  if (typeof projectData !== 'string') return null;
  const start = projectData.indexOf('export const RULES = ');
  const end = projectData.lastIndexOf(';');
  if (start < 0 || end < start) return null;
  try {
    const list = JSON.parse(projectData.slice(start + 'export const RULES = '.length, end));
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

/** The value a guard holds for the rule `id` from `here`, what `ruleHere` gave for it, as `{ value, note }`, or null
 * where it holds none. Where the copy is behind a project that declares the rule, the value is the copy's (`held`),
 * and `note`, said after a refusal, names the update where the project declares the rule otherwise; else it is ''. */
export function guardHeld(id, here) {
  if (Object.hasOwn(here, 'value')) return { value: here.value, note: '' };
  if (!Object.hasOwn(here, 'held')) return null;
  return { value: here.held, note: here.same ? '' : staleNote([id]) };
}

/** The note said after a refusal by a copy that declares the rules `ids` otherwise than the project, or '' for none. */
export function staleNote(ids) {
  if (ids.length === 0) return '';
  const rules = ids.length === 1 ? `rule ${ids[0]}` : `rules ${ids.join(' and ')}`;
  return ` This copy of js-harness declares ${rules} otherwise than the project's bin/lib/rules-data.mjs, so it checked the call by its own declaration: `
    + 'once the change is on main, bring the installed copy up to it (js-harness merge-queue --land --refresh-copy after a land, '
    + "or pnpm add -g github:jsaristi/js-harness#<main's sha>, then js-harness install).";
}

/** A copy of the declaration of the live rule `id`, so that a caller cannot change the list it is read from.
 * It refuses an unknown id and a retired rule as `ruleValue` does, and nothing else. */
export function ruleOf(id, list = RULES) {
  return structuredClone(liveRule(id, list));
}

/** `text` with each `\r\n` read as `\n`, so that a file from Windows compares as one from Unix. */
const lineFeeds = (text) => text.replace(/\r\n/g, '\n');

// The first lines of rules-data.mjs, which writeRules gives first, so that the file keeps its own words.
const HEADER = [
  '// The rules of this project that are declared, one object each, sorted by id. For a rule with a value',
  '// this is its home: the value is written here, in the unit a person says it in, and nowhere else; the',
  '// code that needs it reads it with `ruleValue` of ./rules.mjs (odd/tasks/rule-hierarchy.md, "How a rule',
  '// is declared"). This file is data and imports nothing. Its text is what `writeRules` of ./rules.mjs',
  '// gives for the list, and a test holds it to that: a rule is changed there, never in another shape.',
].map((line) => `${line}\n`).join('');

// The keys of a declaration in the order the file writes them.
const FILE_KEYS = [
  'id', 'subject', 'owner', 'scope', 'since', 'value', 'unit', 'flag', 'alias', 'was',
  'path', 'phrases', 'retired', 'successors', 'patterns', 'row', 'failure', 'differs', 'review',
];
// The keys that say what a rule says, in the order the hash reads them.
export const HASH_KEYS = ['id', 'scope', 'value', 'unit', 'flag', 'alias', 'path', 'phrases', 'retired', 'successors'];

// The last line of that paragraph: where the engine version and the day of a check are read, since the list holds neither.
const LIST_NOTE = 'The list holds no engine version and no date of a check: `js-harness rules applied` reads them from the session records.';
// The paragraph that docs/RULES.md gives under its title.
const RENDER_NOTE = 'Rendered by `js-harness rules render` from `bin/lib/rules-data.mjs` and `docs/rule-sources.json`: do not edit it. A rule is changed with `js-harness rules change <id>`, which writes its declaration (`odd/tasks/rule-hierarchy.md`, "How a rule is declared"), its source and this list together, and this is the one text that shows a value.';

/** A copy of `list` sorted by id, with plain `<` on the texts so that no locale changes the order. */
const byId = (list) => [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** `rule` reduced to `keys`, in that order, with the keys it lacks left out. */
function pick(rule, keys) {
  const out = {};
  for (const key of keys) {
    if (Object.hasOwn(rule, key)) out[key] = rule[key];
  }
  return out;
}

/** A declaration in the shape the file holds: its keys in file order, and its earlier values and row rebuilt
 * with only their own keys, so that a hand-written extra key never reaches the file. */
function canonicalRule(rule) {
  const out = pick(rule, FILE_KEYS);
  if (out.was !== undefined) out.was = out.was.map(({ value, until }) => ({ value, until }));
  if (out.row !== undefined) {
    out.row = Object.hasOwn(out.row, 'refuses')
      ? { refuses: out.row.refuses }
      : { reports: out.row.reports, since: out.row.since };
  }
  return out;
}

/** The whole text of rules-data.mjs for `list`: the header, then the rules as JSON in the one shape the
 * file has, so that the command which changes a rule and a hand that seeds one write the same bytes. */
export function writeRules(list) {
  return `${HEADER}export const RULES = ${JSON.stringify(byId(list).map(canonicalRule), null, 2)};\n`;
}

/** A short name for what the rules say: the first 12 hexadecimal characters of the SHA-256 of the list
 * sorted by id, each rule reduced to the keys that name its value, unit, flag, text and retirement. So an
 * installed copy and a session can tell whether they hold the same rules, and a change of a subject, a
 * source or a row does not change the name, while a change of a value does. */
export function rulesHash(list) {
  const reduced = byId(list).map((rule) => pick(rule, HASH_KEYS));
  return createHash('sha256').update(JSON.stringify(reduced)).digest('hex').slice(0, 12);
}

/** The rules of `list` that hold everywhere: those with no `scope`. */
export function unscoped(list) {
  return list.filter((rule) => rule.scope === undefined);
}

/** The hash a copy of the harness ships, over its unscoped rules only, so that a change of a rule scoped to this
 * repository (his Codex rate) does not call every installed copy behind (odd/tasks/rule-hierarchy.md, "Reach: the
 * hash of the installed command"). The copy's own list is the stamp: computed, never written apart from it. */
export function shippedRulesHash(list) {
  return rulesHash(unscoped(list));
}

/** `text` with its first character in upper case, for a sentence that opens with a subject. */
const upper = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** A number as text with its whole digits grouped in threes (1200 is 1,200), its fraction kept as it is (0.0001 stays
 * 0.0001). A number that `String` writes in exponent form keeps that form (1e-21 stays 1e-21), so no digit is lost. */
const shownNumber = (value) => {
  const text = String(value);
  if (/[eE]/.test(text)) return text;
  const [whole, fraction] = text.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
};

/** A number shown by `shownNumber`, and any other value as text. */
const shown = (value) => (typeof value === 'number' ? shownNumber(value) : String(value));

/** A value and its unit with a space between them, or the value alone when the rule has no unit. */
const amount = (value, unit) => (unit === undefined ? shown(value) : `${shown(value)} ${unit}`);

/** `text` in code marks. */
const code = (text) => `\`${text}\``;

/** The entry of `map` for `id`, or undefined; an own key only, so that no id finds a property of the object. */
const lookup = (map, id) => (Object.hasOwn(map, id) ? map[id] : undefined);

/** The rules that read a value, in code marks and joined, or `none` when no code reads it. */
const readBy = (paths) => (paths === undefined || paths.length === 0 ? 'none' : paths.map((path) => code(path)).join(', '));

/** The row of a rule as the list says it: `reports` when it has none, a refusal from a day, or a report from a day with its reason. */
function rowText(row) {
  if (row === undefined) return 'reports';
  if (Object.hasOwn(row, 'refuses')) return `refuses since ${row.refuses}`;
  return `reports since ${row.since} (${row.reports})`;
}

/** The source of a rule: the design it is written in, or the dates of his words that set it and the check that read them.
 * A source of another shape is `not readable`, so that no source can make the list throw; rules-check.mjs names each one. */
function sourceText(source) {
  if (source === undefined) return 'none recorded';
  if (!isObject(source)) return 'not readable';
  if (source.kind === 'design') return typeof source.path === 'string' ? `design, ${code(source.path)}` : 'not readable';
  const words = source.kind === 'words' && Array.isArray(source.quotes) && source.quotes.every(isObject) && isObject(source.checked);
  if (!words) return 'not readable';
  const dates = source.quotes.map((quote) => show(quote.date)).join(', ');
  const who = source.checked.by === 'session' ? 'a session' : 'the command';
  return `his words of ${dates}, checked by ${who} on ${show(source.checked.date)}`;
}

/** The failure of the register a rule's row guards against, after the row, or nothing for a rule that names none. */
const failureText = (rule) => (typeof rule.failure === 'string' ? `, against the failure ${code(rule.failure)}` : '');

/** The line that gives a rule's day, its row with its failure, and its source. */
const sinceLine = (rule, sources) => `- Since ${rule.since}. Row: ${rowText(rule.row)}${failureText(rule)}. Source: ${sourceText(lookup(sources, rule.id))}.`;

/** The line of a rule's earlier values, each with the rule's unit, in the order the rule gives them. */
const wasLine = (rule) => `- Was: ${rule.was.map((item) => `${amount(item.value, rule.unit)} until ${item.until}`).join('; ')}.`;

/** The lines a rule shows after its first line, each only when the rule has its field: the alias it is passed as on a
 * call, its scope, and the day it is looked at again. */
const fieldLines = (rule) => [
  ...(rule.alias === undefined ? [] : [`- Passed on a call as ${code(rule.alias)}.`]),
  ...(rule.scope === undefined ? [] : ['- Of this repository only: not in force in a project that installs the harness.']),
  ...(rule.review === undefined ? [] : [`- Looked at again on ${rule.review}.`]),
];

/** The block of a rule with a value: its subject and value, its field lines, its earlier values when it has any, the rules that read it, and its source. */
function valueBlock(rule, { sources, readers }) {
  const override = rule.flag === undefined ? '' : ` The flag ${code(rule.flag)} overrides it for one run.`;
  const lines = [`### ${rule.id}`, `${upper(rule.subject)}: ${amount(rule.value, rule.unit)}.${override}`, ...fieldLines(rule)];
  if ((rule.was ?? []).length > 0) lines.push(wasLine(rule));
  lines.push(`- Read by: ${readBy(lookup(readers, rule.id))}.`);
  lines.push(sinceLine(rule, sources));
  return lines.join('\n');
}

/** The block of a rule in prose: its sentence, or a note that the sentence was not found in its file. */
function proseBlock(rule, { sources, sentences }) {
  const sentence = lookup(sentences, rule.id);
  const subject = upper(rule.subject);
  const first = sentence === undefined
    ? `${subject}: its text was not found in ${code(rule.path)}.`
    : `${subject}: "${sentence}"`;
  return [`### ${rule.id}`, first, `- Home: ${code(rule.path)}.`, ...fieldLines(rule), sinceLine(rule, sources)].join('\n');
}

/** The block of a retired rule: the day it was retired, the rules that replace it, and its earlier values and source. */
function retiredBlock(rule, { sources }) {
  const successors = rule.successors ?? [];
  const replaced = successors.length === 0 ? 'no rule replaces it' : `read ${successors.map((id) => code(id)).join(', ')} instead`;
  const lines = [`### ${rule.id}`, `${upper(rule.subject)}. Retired on ${rule.retired}: ${replaced}.`];
  if ((rule.was ?? []).length > 0) lines.push(wasLine(rule));
  lines.push(`- Source: ${sourceText(lookup(sources, rule.id))}.`);
  return lines.join('\n');
}

/** A section of docs/RULES.md: its heading, then its blocks with a blank line between them, or `None.` with no block. */
function section(heading, blocks) {
  return [heading, blocks.length === 0 ? 'None.' : blocks.join('\n\n')].join('\n\n');
}

/** The text of docs/RULES.md for `list`. It is pure: the sources, the readers and the sentences of the rules
 * come in as arguments, so the text depends on nothing it is not given. Each section lists its rules by id. It expects
 * a list that `readRules` accepted. */
export function renderList(list, { sources = {}, readers = {}, sentences = {} } = {}) {
  const rules = byId(list);
  const inForce = rules.filter((rule) => !Object.hasOwn(rule, 'retired'));
  const retired = rules.filter((rule) => Object.hasOwn(rule, 'retired'));
  const sebastian = inForce.filter((rule) => rule.owner === 'sebastian');
  const project = inForce.filter((rule) => rule.owner === 'project');
  const block = (rule) => (Object.hasOwn(rule, 'value')
    ? valueBlock(rule, { sources, readers })
    : proseBlock(rule, { sources, sentences }));
  return [
    '# Rules',
    `${RENDER_NOTE}\n${LIST_NOTE}`,
    `Hash ${code(rulesHash(list))}. In force: ${shown(inForce.length)} (${shown(sebastian.length)} of Sebastián, ${shown(project.length)} of the project). Retired: ${shown(retired.length)}.`,
    section("## Sebastián's", sebastian.map(block)),
    section("## The project's", project.map(block)),
    section('## Retired', retired.map((rule) => retiredBlock(rule, { sources }))),
  ].join('\n\n').concat('\n');
}
