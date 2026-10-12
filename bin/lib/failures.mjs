// The failures register: `docs/FAILURES.md`, one entry per thing that went wrong, each tied to the
// control that corrects it and counted by how often it came back — see odd/tasks/rule-hierarchy.md
// ("The failures register"). This file reads a register, says what makes it unreadable, computes each
// entry's state and counts. No fs here: every function takes text or plain data, and what a state
// needs to know about another file is asked through a `holds` function the caller supplies, so the
// tests use inline strings.
import { tokenize } from './progress.mjs';
import { ruleValue } from './rules.mjs';

/** The seven states an entry can be in. None is written in the file: a state written by hand would
 * be one more statement that can be false, so each is computed from the fields (`entryState`). */
export const STATES = ['once', 'repeated', 'owed', 'owed, stale', 'controlled', 'control lost', 'seen again'];
const SETTLED = new Set(['once', 'owed', 'controlled']);

const FIELDS = ['Class', 'Aka', 'Seen', 'Control', 'Proof', 'Was'];
const FIELD_LIST = `${FIELDS.slice(0, -1).join(', ')} and ${FIELDS.at(-1)}`;
// The three levels of the placement rule a control in place sits at.
const LEVELS = ['check', 'line', 'protocol'];
// A phrase shorter than this could be found in a file by accident. The number is a declared rule.
const MIN_PHRASE = ruleValue('control-phrase-min', 'characters');
// What cuts a field into its parts. Never a bare dash: a note or a phrase may hold those.
const SEPARATOR = ' — ';

// Each word starts with a letter, so no id, and no word of one, is a number.
const ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
// A field opens a list item at the start of its line: `- Name: value`.
const FIELD_PATTERN = /^[-*+]\s+([A-Z][A-Za-z]*):\s*(.*)$/;
const CONTINUATION_PATTERN = /^\s+\S/;
// A class is declared by a list item that opens with its id in a code span.
const CLASS_PATTERN = /^\s*[-*+]\s+`([^`]+)`/;
const SINCE_PATTERN = /^ — since (\S+)$/;
// A list item, with a checkbox or without one: `- text`, `* text`, `1. text`, `2) text`.
const LIST_ITEM_PATTERN = /^\s*(?:[-*+]|\d+[.)])\s+\S/;

// Refused, and not read around: it would swallow every entry after it without a word.
const OPEN_FENCE =
  'a code fence is left open: every line after it is read as code and every entry after it is lost; close it with a line that holds only its marker';
const SEEN_SHAPE ='"- Seen: <YYYY-MM-DD> — <where the evidence is> — <a note>"';
const CONTROL_SHAPES =
  'a control is written `owed — <document> — "<phrase>"` or `<check|line|protocol> — <path> — "<phrase>" — since <YYYY-MM-DD>`';

/** `text` with every run of white space read as one space: the files here end their lines with a
 * carriage return and wrap their sentences, and neither may change what a field or a phrase says. */
const squash = (text) => text.replace(/\s+/g, ' ').trim();

/** Orders two strings by their characters, the same on every machine (no locale). */
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** True for a real day written `YYYY-MM-DD`: `2026-02-30` has the shape and is no date. */
function isDate(text) {
  const match = text.match(DATE_PATTERN);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** What keeps `file` from being a path of the repository, as the end of a sentence about it, or
 * `null` when it is one: forward slashes, not absolute, no `..` (as `documentFault` of
 * `bin/check.mjs` refuses them), so that no entry makes its reader open a file outside the project. */
function pathFault(file) {
  if (file.includes('\\')) return 'is written with a backslash';
  if (file.startsWith('/') || /^[A-Za-z]:/.test(file)) return 'is an absolute path';
  return file.split('/').some((segment) => ['', '.', '..'].includes(segment)) ? 'has an empty, "." or ".." segment' : null;
}

/** One `Seen` value as `{ sighting }` or `{ error }`. It takes the date at its start and is cut at
 * the first two long dashes only, so the note may hold dashes, quotes and dates. */
function readSeen(value) {
  const first = value.indexOf(SEPARATOR);
  const second = first === -1 ? -1 : value.indexOf(SEPARATOR, first + SEPARATOR.length);
  const date = value.slice(0, Math.max(first, 0));
  const evidence = second === -1 ? '' : value.slice(first + SEPARATOR.length, second).trim();
  const note = second === -1 ? '' : value.slice(second + SEPARATOR.length).trim();
  if (evidence === '' || note === '') {
    return { error: `cannot read "- Seen: ${value}": a sighting is written ${SEEN_SHAPE}, cut at long dashes between spaces` };
  }
  if (!isDate(date)) return { error: `in Seen, "${date}" is no date: a date is written YYYY-MM-DD` };
  return { sighting: { date, evidence, note } };
}

/** One `Control` value as `{ control, errors }`. It takes its first word, the `— since <date>` at its
 * end and the phrase between the outermost quotes, so a phrase may hold a quote or a dash. An owed
 * control and one in place both name a file and a phrase, kept as `path` and `phrase`. */
function readControl(value) {
  const level = value.split(' ', 1)[0];
  const open = value.indexOf('"');
  const close = value.lastIndexOf('"');
  const between = value.slice(level.length, open); // ` — <path> — `
  const tail = value.slice(close + 1); // nothing when owed, ` — since <date>` when in place
  const since = tail.match(SINCE_PATTERN)?.[1];
  const ends = level === 'owed' ? tail === '' : LEVELS.includes(level) && since !== undefined;
  const namesPath = between.startsWith(SEPARATOR) && between.endsWith(SEPARATOR) && between.length > 2 * SEPARATOR.length;
  if (!ends || open === close || !namesPath) return { control: null, errors: [`cannot read the control "${value}": ${CONTROL_SHAPES}`] };

  const file = between.slice(SEPARATOR.length, -SEPARATOR.length).trim();
  const phrase = value.slice(open + 1, close).trim();
  const errors = [];
  const wrong = pathFault(file);
  if (wrong) errors.push(`the path "${file}" ${wrong}: a path starts at the top of the repository and uses forward slashes`);
  if (level === 'check' && /\.md$/i.test(file)) {
    errors.push(`a check is never a .md file ("${file}"): a check names the test file that proves it, and prose is a line or a protocol`);
  }
  if (phrase.length < MIN_PHRASE) {
    errors.push(`the phrase "${phrase}" has ${phrase.length} characters: a phrase has at least twelve, so that it is not found by accident`);
  }
  if (level !== 'owed' && !isDate(since)) errors.push(`in Control, "${since}" is no date: a date is written YYYY-MM-DD`);
  return { control: level === 'owed' ? { level, path: file, phrase } : { level, path: file, phrase, since }, errors };
}

/** Adds one line under an entry's heading to its draft: a field, the indented continuation of the
 * field above it, a line of the text (everything before the first field), or, after the first
 * field, a line that is none of these, of which the first is kept to be refused. */
function addLine(draft, token) {
  const { line } = token;
  draft.lines.push(line);
  const field = token.fence ? null : line.match(FIELD_PATTERN);
  if (field) {
    draft.open = { name: field[1], parts: [field[2]] };
    draft.fields.push(draft.open);
  } else if (draft.open && !token.fence && CONTINUATION_PATTERN.test(line)) {
    draft.open.parts.push(line);
  } else {
    draft.open = null;
    if (draft.fields.length === 0) draft.text.push(line);
    else if (line.trim() !== '') draft.stray ??= line.trim();
  }
}

/** The entry a draft holds, with every fault of its content told through `fault`. `source` is the
 * entry as written, for a reader that prints it whole. */
function readEntry(draft, classes, fault) {
  const entry = {
    id: draft.id,
    text: draft.text.join('\n').trim(),
    class: null,
    aka: [],
    seen: [],
    control: null,
    proof: [],
    was: [],
    source: draft.lines.join('\n').trimEnd(),
  };
  if (entry.text === '') fault('has no text: say what happened in the lines between the heading and the first field');

  const values = new Map(FIELDS.map((name) => [name, []]));
  for (const { name, parts } of draft.fields) {
    const value = squash(parts.join(' '));
    if (!values.has(name)) fault(`field "${name}" is not known: the fields are ${FIELD_LIST}`);
    else if (value === '') fault(`field "${name}" is empty: write its value after the colon, or drop the line`);
    else values.get(name).push(value);
  }
  const written = (name) => draft.fields.some((field) => field.name === name);

  const named = values.get('Class');
  if (!written('Class')) fault('has no class: add "- Class: <id>", one of the classes under "## Classes"');
  else if (named.length > 1) fault(`has ${named.length} Class fields: an entry has one class`);
  else if (named.length === 1 && !classes.includes(named[0])) {
    const declared = classes.length > 0 ? `the classes are ${classes.join(', ')}` : 'the file declares none';
    fault(`class "${named[0]}" is not declared: ${declared}, and one is declared as a list item under "## Classes" (- \`id\` what it means)`);
  } else {
    entry.class = named[0] ?? null;
  }

  if (!written('Seen')) fault(`has no sighting: add ${SEEN_SHAPE}`);
  for (const value of values.get('Seen')) {
    const { sighting, error } = readSeen(value);
    if (error) fault(error);
    else entry.seen.push(sighting);
  }

  const controls = values.get('Control');
  if (controls.length > 1) {
    fault(`has ${controls.length} Control fields: an entry has one control, and a control that left moves to a "- Was:" line`);
  } else if (controls.length === 1) {
    const { control, errors } = readControl(controls[0]);
    entry.control = control;
    errors.forEach(fault);
  }

  entry.aka = values.get('Aka');
  entry.proof = values.get('Proof');
  entry.was = values.get('Was');
  if (draft.stray !== null) {
    fault(`cannot read the line "${draft.stray}": after the first field an entry holds only fields ("- Name: value") and their indented continuation lines`);
  }
  return entry;
}

/** A register read from its text: `{ classes, entries, errors }`. `classes` are the ids declared
 * under `## Classes`; `entries` are the `### <id>` entries under `## Entries`, in file order;
 * `errors` are the faults that make the register unreadable, each saying what is missing and how it
 * is written. They are what the register alone shows, which the session editing it can always
 * repair: nothing here depends on another file or on the day. A register with any error is not to
 * be counted from. */
export function parseRegister(markdown) {
  // A byte-order mark is dropped. The line added at the end can open or close no fence, so it is
  // fenced only when a fence was left open.
  const tokens = tokenize(`${markdown.replace(/^\uFEFF/, '')}\n`);
  const fenceLeftOpen = tokens.at(-1).fence === true;

  const classes = [];
  const declaredTwice = new Set();
  const drafts = [];
  let section = null; // the title of the `## ` section being read
  let hasEntries = false;
  let draft = null; // the entry being read
  for (const token of tokens) {
    const level = token.heading?.level;
    if (level <= 2) {
      section = level === 2 ? token.heading.title : null;
      hasEntries ||= section === 'Entries';
      draft = null;
    } else if (section === 'Classes') {
      const declared = token.fence ? null : token.line.match(CLASS_PATTERN)?.[1].trim();
      if (declared && classes.includes(declared)) declaredTwice.add(declared);
      else if (declared) classes.push(declared);
    } else if (section === 'Entries' && level === 3) {
      draft = { id: token.heading.title, lines: [token.line], text: [], fields: [], open: null, stray: null };
      drafts.push(draft);
    } else if (section === 'Entries' && draft) {
      addLine(draft, token);
    }
  }

  // A class kept twice would be counted twice, with every entry and sighting of it.
  const errors = [...declaredTwice].map((id) => `class "${id}" is declared twice under "## Classes": declare it once`);
  const entries = [];
  const ids = new Set();
  let previous = null; // the id of the entry above, among the ids that are in the shape
  for (const current of drafts) {
    const { id } = current;
    const fault = (message) => errors.push(`entry "${id}": ${message}`);
    if (!ID_PATTERN.test(id)) {
      fault('the id is not lowercase words joined by hyphens, as in "language-server-load" (a word starts with a letter, so no id is a number)');
    } else {
      if (ids.has(id)) fault('the id appears twice: one failure is one entry, and seeing it again is one more "- Seen:" line');
      else if (previous !== null && id < previous) fault(`comes after "${previous}": entries are kept in the alphabetical order of their ids`);
      ids.add(id);
      previous = id;
    }
    // An open fence swallowed the rest of the entry it is in, so nothing else about it can be judged.
    const swallowed = fenceLeftOpen && current === draft;
    if (swallowed) fault(OPEN_FENCE);
    entries.push(readEntry(current, classes, swallowed ? () => {} : fault));
  }

  // A fence left open above `## Entries` swallows that heading too, so only the fence is told.
  if (fenceLeftOpen && !draft) {
    errors.push(OPEN_FENCE);
  } else if (!fenceLeftOpen && !hasEntries) {
    errors.push('missing section "## Entries": each failure is a "### <id>" entry under it');
  }
  return { classes, entries, errors };
}

/** The sightings of an entry, sorted by day. Two `Seen` lines with the same date and the same
 * evidence are one sighting, so two sessions that read the same record do not count it twice; how
 * many there are is how often the thing came back, which is never written as a figure. */
export function sightings(entry) {
  const unique = new Map();
  for (const sighting of entry.seen) {
    const key = `${sighting.date}\n${sighting.evidence}`;
    if (!unique.has(key)) unique.set(key, sighting);
  }
  return [...unique.values()].sort((a, b) => compare(a.date, b.date) || compare(a.evidence, b.evidence));
}

/** The checkbox items of `markdown` that are not checked off, one string each: a wrapped item is one
 * item, ended by the next list item, with a checkbox or without one, a blank line, a heading or a
 * fence. Items inside a fence are none, a fence indented under an item included, and what a comment
 * holds is not read: a task kept in a comment or shown as an example owes nothing. */
function uncheckedItems(markdown) {
  const items = [];
  let open = false; // whether the lines that follow continue the last item of `items`
  // The tokenizer is asked for fences at any indentation, so that it is the one to tell a fence
  // from a code span and to keep a `<!--` inside a fence from opening a comment.
  for (const token of tokenize(markdown, { stripComments: true, indentedFences: true })) {
    if (token.step) {
      open = !token.step.done;
      if (open) items.push(token.step.text);
    } else if (open && !token.fence && !token.heading && CONTINUATION_PATTERN.test(token.line) && !LIST_ITEM_PATTERN.test(token.line)) {
      items[items.length - 1] += ` ${token.line}`;
    } else {
      open = false;
    }
  }
  return items.map(squash);
}

/** Whether `text`, the content of a file, holds `phrase`, with every run of white space read as one
 * space on both sides. With `unchecked`, only inside a list item that is not checked off: the task
 * that still owes a control. A phrase found is not a control that works; the test it names proves
 * that. */
export function holdsPhrase(text, phrase, { unchecked = false } = {}) {
  const wanted = squash(phrase);
  if (unchecked) return uncheckedItems(text).some((item) => item.includes(wanted));
  return squash(text).includes(wanted);
}

/** The state of `entry`, one of `STATES`. `holds(path, phrase, { unchecked })` answers for the
 * caller's files whether the file at `path` holds `phrase` (in an unchecked list item, for a control
 * that is owed); a file that is gone holds nothing. A date has no hour, so a sighting on the day the
 * control reached `main` reads as seen before it. */
export function entryState(entry, holds) {
  const { control } = entry;
  const seen = sightings(entry);
  if (!control) return seen.length > 1 ? 'repeated' : 'once';
  if (control.level === 'owed') return holds(control.path, control.phrase, { unchecked: true }) ? 'owed' : 'owed, stale';
  if (!holds(control.path, control.phrase, { unchecked: false })) return 'control lost';
  return seen.some((sighting) => sighting.date > control.since) ? 'seen again' : 'controlled';
}

/** True for the three states that ask nothing of anybody: `once`, `owed` and `controlled`. */
export function isSettled(state) {
  return SETTLED.has(state);
}

/** The counts of a register read without a fault, with `holds` as `entryState` takes it:
 * `entries`, `sightings`, `repeated` (the entries seen more than once, whatever their control),
 * `unsettled`, `was` (the `Was` lines: the controls that had to be replaced), `byClass` in the order
 * the classes are declared, `byState` for all seven, and `rows`, one per entry, the most seen first. */
export function summarize({ classes, entries }, holds) {
  const rows = entries
    .map((entry) => {
      const seen = sightings(entry);
      const state = entryState(entry, holds);
      return { id: entry.id, class: entry.class, state, settled: isSettled(state), sightings: seen.length, firstSeen: seen[0]?.date ?? null };
    })
    .sort((a, b) => b.sightings - a.sightings || compare(a.id, b.id));
  const total = (list) => list.reduce((sum, row) => sum + row.sightings, 0);
  return {
    entries: rows.length,
    sightings: total(rows),
    repeated: rows.filter((row) => row.sightings > 1).length,
    unsettled: rows.filter((row) => !row.settled).length,
    was: entries.reduce((sum, entry) => sum + entry.was.length, 0),
    byClass: classes.map((name) => {
      const inClass = rows.filter((row) => row.class === name);
      return { class: name, entries: inClass.length, sightings: total(inClass) };
    }),
    byState: Object.fromEntries(STATES.map((state) => [state, rows.filter((row) => row.state === state).length])),
    rows,
  };
}
